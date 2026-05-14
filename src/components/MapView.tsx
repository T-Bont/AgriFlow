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
  /** When true, force a north-up, pitch-0 (2D) camera and disable rotation/pitch gestures. */
  northUp2D?: boolean
  /** When 'profit', polygon fill is green (positive) or red (negative) using pnlByFieldId */
  colorBy?: MapColorBy
  /** Required when colorBy === 'profit'. Key = field_id. */
  pnlByFieldId?: Record<string, { net_income: number }>
  /** When true, show draw control to create a polygon; on complete call onBoundaryDrawn */
  drawMode?: boolean
  onBoundaryDrawn?: (boundary: GeoJSON.Polygon, gisAcres: number) => void
  /** When true, enable editing existing field polygons directly on the map. */
  editBoundaryMode?: boolean
  onBoundaryEdited?: (fieldId: string, boundary: GeoJSON.Polygon, gisAcres: number) => void
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
  /** Returns a normalized north-up 2D view plus the map's CSS pixel size (for static image sizing). */
  getSnapshotView: () =>
    | {
        bbox: { west: number; south: number; east: number; north: number }
        camera: {
          center: [number, number]
          zoom: number
          bearing: number
          pitch: number
        }
        size: { width: number; height: number }
      }
    | null

  /** Projects lng/lat into this map's current canvas pixel coordinate space, normalized to 0..1. */
  projectLngLatToNorm: (lng: number, lat: number) =>
    | {
        nx: number
        ny: number
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
    northUp2D = false,
    colorBy = 'crop',
    pnlByFieldId = {},
    drawMode = false,
    onBoundaryDrawn,
    editBoundaryMode = false,
    onBoundaryEdited,
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
  const onFieldSelectRef = useRef(onFieldSelect)
  onFieldSelectRef.current = onFieldSelect
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const onBoundaryDrawnRef = useRef(onBoundaryDrawn)
  onBoundaryDrawnRef.current = onBoundaryDrawn
  const onBoundaryEditedRef = useRef(onBoundaryEdited)
  onBoundaryEditedRef.current = onBoundaryEdited

  useImperativeHandle(
    ref,
    () => ({
      getCurrentView: () => {
        if (!mapRef.current) return null
        const map = mapRef.current
        const bounds = map.getBounds()!
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
      getSnapshotView: () => {
        if (!mapRef.current) return null
        const map = mapRef.current
        // Force a predictable 2D camera to match bbox-based static imagery + simple overlay math.
        try {
          map.setBearing(0)
          map.setPitch(0)
        } catch {
          // ignore
        }
        const bounds = map.getBounds()!
        const center = map.getCenter()
        const canvas = map.getCanvas()
        const width = Math.round(canvas.clientWidth || canvas.width)
        const height = Math.round(canvas.clientHeight || canvas.height)
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
          size: { width, height },
        }
      },
      projectLngLatToNorm: (lng: number, lat: number) => {
        if (!mapRef.current) return null
        const map = mapRef.current
        const canvas = map.getCanvas()
        const canvasW = canvas.clientWidth || canvas.width || 1
        const canvasH = canvas.clientHeight || canvas.height || 1

        const p = map.project([lng, lat])
        const x = p.x / (canvasW || 1)
        const y = p.y / (canvasH || 1)

        return {
          nx: Math.max(0, Math.min(1, x)),
          ny: Math.max(0, Math.min(1, y)),
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
    const el = containerRef.current
    if (!el) return

    // Prevent the dashboard page from scrolling when the cursor is over the map,
    // but allow Mapbox to still handle the wheel event for zooming.
    const onWheel = (e: WheelEvent) => {
      if (!mapRef.current) return
      e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  useEffect(() => {
    if (!loaded || !mapRef.current) return
    if (!northUp2D) return
    const map = mapRef.current
    try {
      map.setBearing(0)
      map.setPitch(0)
      map.dragRotate.disable()
      map.touchZoomRotate.disableRotation()
      // Prevent any future pitch from being applied via controls.
      map.setMaxPitch(0)
    } catch {
      // ignore
    }
  }, [loaded, northUp2D])

  useEffect(() => {
    if (!loaded || !mapRef.current || !containerRef.current) return
    const map = mapRef.current
    const container = containerRef.current

    const triggerResize = () => {
      map.resize()
    }

    triggerResize()

    const observer = new ResizeObserver(() => {
      triggerResize()
    })
    observer.observe(container)

    window.addEventListener('resize', triggerResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', triggerResize)
    }
  }, [loaded])

  useEffect(() => {
    if (!loaded || !mapRef.current) return
    if (!drawMode && !editBoundaryMode) return
    const map = mapRef.current
    let cancelled = false
    let cleanup: (() => void) | undefined
    import('@mapbox/mapbox-gl-draw').then(({ default: MapboxDraw }) => {
      if (cancelled) return
      const isEditMode = editBoundaryMode && !!onBoundaryEditedRef.current
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: isEditMode ? { trash: false } : { polygon: true, trash: true },
        defaultMode: isEditMode ? 'simple_select' : 'draw_polygon',
      })
      map.addControl(draw as unknown as mapboxgl.IControl, 'top-left')
      drawRef.current = draw

      if (isEditMode) {
        const editableFeatures = fieldsRef.current
          .filter((f) => f.boundary && typeof f.boundary === 'object' && 'coordinates' in f.boundary)
          .map((f) => ({
            type: 'Feature' as const,
            id: f.id,
            properties: { id: f.id },
            geometry: f.boundary as GeoJSON.Polygon,
          }))

        if (editableFeatures.length > 0) {
          draw.add({
            type: 'FeatureCollection',
            features: editableFeatures,
          })
        }
        const handler = (e: {
          features?: Array<{ id?: string | number; geometry?: { type?: string; coordinates?: number[][][] } }>
        }) => {
          const feature = e.features?.[0]
          const id = feature?.id
          if (!feature || typeof id !== 'string') return
          if (feature.geometry?.type !== 'Polygon' || !feature.geometry.coordinates) return
          const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: feature.geometry.coordinates }
          const acres = polygonAcres(polygon.coordinates)
          onBoundaryEditedRef.current?.(id, polygon, acres)
        }

        map.on('draw.update', handler)
        cleanup = () => {
          map.off('draw.update', handler)
          if (drawRef.current) {
            try { map.removeControl(drawRef.current as mapboxgl.IControl) } catch { /* already removed */ }
            drawRef.current = null
          }
        }
        return
      }

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
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [loaded, drawMode, editBoundaryMode, onBoundaryDrawn, onBoundaryEdited])

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
        const field = fieldsRef.current.find((f) => f.id === id)
        if (field) onFieldSelectRef.current(field)
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
    <div
      ref={containerRef}
      className="map-container"
      style={{ width: '100%', height: '100%', minHeight: 280, touchAction: 'pan-x pan-y' }}
    />
  )
})

export default MapView
