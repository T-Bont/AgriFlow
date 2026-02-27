import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Field } from '@/types/database'
import { polygonAcres, boundsFromPolygons } from '@/lib/geo'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
/** Mapbox GL JS requires a public token (pk.*). Secret tokens (sk.*) must not be used in the browser. */
const MAPBOX_TOKEN_IS_PUBLIC = typeof MAPBOX_TOKEN === 'string' && MAPBOX_TOKEN.startsWith('pk.')

interface FieldWithCrop extends Field {
  crop_type?: string
}

export type MapColorBy = 'crop' | 'profit'

interface MapViewProps {
  fields: FieldWithCrop[]
  onFieldSelect: (field: Field) => void
  onMapClick?: (lng: number, lat: number) => void
  initialCenter?: [number, number]
  initialZoom?: number
  /** When 'profit', polygon fill is green (positive) or red (negative) using pnlByFieldId */
  colorBy?: MapColorBy
  /** Required when colorBy === 'profit'. Key = field_id. */
  pnlByFieldId?: Record<string, { net_income: number }>
  /** When true, show draw control to create a polygon; on complete call onBoundaryDrawn */
  drawMode?: boolean
  onBoundaryDrawn?: (boundary: GeoJSON.Polygon, gisAcres: number) => void
  /** When true (default), fit map bounds to all fields on load and when field boundaries change */
  fitBoundsToFields?: boolean
}

export interface MapViewHandle {
  getCurrentView: () =>
    | {
        bbox: { west: number; south: number; east: number; north: number }
        camera: {
          center: [number, number]
          zoom: number
          bearing: number
          pitch: number
        }
      }
    | null
}

const CROP_COLORS: Record<string, string> = {
  Corn: '#e6b800',
  Soy: '#2d5a27',
  Wheat: '#c4a35a',
  Other: '#888',
}

const PROFIT_COLORS = { positive: '#2d5a27', negative: '#b33' }

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    fields,
    onFieldSelect,
    initialCenter = [-98.5795, 39.8283],
    initialZoom = 3,
    colorBy = 'crop',
    pnlByFieldId = {},
    drawMode = false,
    onBoundaryDrawn,
    fitBoundsToFields = true,
  }: MapViewProps,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<unknown>(null)
  const cleanupMapRef = useRef<(() => void) | null>(null)
  const lastFittedBoundsKeyRef = useRef<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const onBoundaryDrawnRef = useRef(onBoundaryDrawn)
  onBoundaryDrawnRef.current = onBoundaryDrawn

  useImperativeHandle(
    ref,
    () => ({
      getCurrentView: () => {
        if (!mapRef.current) return null
        const map = mapRef.current
        const bounds = map.getBounds()
        const center = map.getCenter()
        return {
          bbox: {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          },
          camera: {
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          },
        }
      },
    }),
    [],
  )

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || !MAPBOX_TOKEN_IS_PUBLIC) {
      setLoaded(true)
      return
    }
    let cancelled = false
    import('mapbox-gl').then((mapboxgl) => {
      if (cancelled) return
      mapboxgl.default.accessToken = MAPBOX_TOKEN
      const map = new mapboxgl.default.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: initialCenter,
        zoom: initialZoom,
      })
      map.addControl(new mapboxgl.default.NavigationControl(), 'top-right')
      map.on('load', () => {
        if (!cancelled) setLoaded(true)
      })
      mapRef.current = map
      cleanupMapRef.current = () => {
        if (drawRef.current) {
          try { map.removeControl(drawRef.current as mapboxgl.IControl) } catch { /* already removed */ }
          drawRef.current = null
        }
        map.remove()
        mapRef.current = null
        cleanupMapRef.current = null
      }
    })
    return () => {
      cancelled = true
      setLoaded(false)
      cleanupMapRef.current?.()
      cleanupMapRef.current = null
    }
  }, [initialCenter[0], initialCenter[1], initialZoom])

  useEffect(() => {
    if (!loaded || !mapRef.current || !drawMode || !onBoundaryDrawn) return
    const map = mapRef.current
    let cleanup: (() => void) | undefined
    import('@mapbox/mapbox-gl-draw').then(({ default: MapboxDraw }) => {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'draw_polygon',
      })
      map.addControl(draw as unknown as mapboxgl.IControl, 'top-left')
      drawRef.current = draw
      const handler = () => {
        const data = draw.getAll()
        const feature = data.features[0]
        if (feature?.geometry?.type === 'Polygon' && feature.geometry.coordinates) {
          const polygon: GeoJSON.Polygon = {
            type: 'Polygon',
            coordinates: feature.geometry.coordinates,
          }
          const acres = polygonAcres(polygon.coordinates)
          onBoundaryDrawnRef.current?.(polygon, acres)
          draw.deleteAll()
        }
      }
      map.on('draw.create', handler)
      cleanup = () => {
        map.off('draw.create', handler)
        if (drawRef.current) {
          try { map.removeControl(drawRef.current as mapboxgl.IControl) } catch { /* already removed */ }
          drawRef.current = null
        }
      }
    })
    return () => cleanup?.()
  }, [loaded, drawMode, onBoundaryDrawn])

  useEffect(() => {
    if (!loaded || !mapRef.current || !MAPBOX_TOKEN || !MAPBOX_TOKEN_IS_PUBLIC) return
    const map = mapRef.current
    const sourceId = 'fields-source'
    const layerId = 'fields-fill'

    const features = fields
      .filter((f) => f.boundary && typeof f.boundary === 'object' && 'coordinates' in f.boundary)
      .map((f) => {
        const pnl = pnlByFieldId[f.id]
        const profitClass = pnl ? (pnl.net_income >= 0 ? 'positive' : 'negative') : null
        return {
          type: 'Feature' as const,
          id: f.id,
          properties: {
            id: f.id,
            name: f.name,
            crop: f.crop_type ?? 'Other',
            profit: profitClass,
          },
          geometry: f.boundary as GeoJSON.Polygon,
        }
      })

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features,
      })
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      })
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': ['get', 'crop'],
          'fill-opacity': 0.5,
          'fill-outline-color': '#1a3c34',
        },
      })
      map.on('click', layerId, (e) => {
        const id = e.features?.[0]?.properties?.id
        const field = fields.find((f) => f.id === id)
        if (field) onFieldSelect(field)
      })
      map.getCanvas().style.cursor = 'pointer'
    }

    const paintColor =
      colorBy === 'profit'
        ? [
            'match',
            ['get', 'profit'],
            'positive',
            PROFIT_COLORS.positive,
            'negative',
            PROFIT_COLORS.negative,
            '#888',
          ]
        : [
            'match',
            ['get', 'crop'],
            'Corn',
            CROP_COLORS.Corn,
            'Soy',
            CROP_COLORS.Soy,
            'Wheat',
            CROP_COLORS.Wheat,
            CROP_COLORS.Other,
          ]
    map.setPaintProperty(layerId, 'fill-color', paintColor as mapboxgl.ExpressionSpecification)

    if (fitBoundsToFields && features.length > 0) {
      const fieldsWithBoundaries = fields.filter(
        (f) => f.boundary && typeof f.boundary === 'object' && 'coordinates' in f.boundary,
      )
      const boundsKey = fieldsWithBoundaries
        .map((f) => f.id + JSON.stringify((f.boundary as GeoJSON.Polygon)?.coordinates))
        .join('|')
      if (boundsKey !== lastFittedBoundsKeyRef.current) {
        const bounds = boundsFromPolygons(
          fieldsWithBoundaries.map((f) => (f.boundary as GeoJSON.Polygon) ?? null),
        )
        if (bounds) {
          lastFittedBoundsKeyRef.current = boundsKey
          map.fitBounds(bounds, { padding: 20, maxZoom: 18 })
        }
      }
    }
  }, [loaded, fields, onFieldSelect, colorBy, pnlByFieldId, fitBoundsToFields])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="map-fallback">
        <p>Add <code>VITE_MAPBOX_TOKEN</code> to use the map.</p>
        <p>Fields without boundaries will still appear in the list below.</p>
      </div>
    )
  }
  if (!MAPBOX_TOKEN_IS_PUBLIC) {
    return (
      <div className="map-fallback">
        <p>Use a <strong>public</strong> Mapbox token (<code>pk.*</code>) in the browser, not a secret token (<code>sk.*</code>).</p>
        <p>Create a public token at <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer">Mapbox Access Tokens</a> and set <code>VITE_MAPBOX_TOKEN</code> in <code>.env</code>.</p>
        <p>Fields without boundaries will still appear in the list below.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="map-container" style={{ width: '100%', height: '100%', minHeight: 280 }} />
  )
})

export default MapView
