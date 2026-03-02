import { useEffect, useMemo, useRef, useState } from 'react'
import type { Field, FieldPnlRow } from '@/types/database'
import type { MapColorBy } from '@/components/MapView'

type SnapshotConfig = {
  bbox: {
    west: number
    south: number
    east: number
    north: number
  }
  image_url: string
  width: number
  height: number
  scale?: number
}

type FieldWithCrop = Field & { crop_type?: string }

export type SnapshotEditMode = 'view' | 'draw_new_field' | 'edit_boundary'

interface DashboardSnapshotViewProps {
  snapshot: SnapshotConfig
  fields: FieldWithCrop[]
  pnlByFieldId?: Record<string, Pick<FieldPnlRow, 'net_income'>>
  colorBy?: MapColorBy
  onFieldSelect: (field: Field) => void
  mode?: SnapshotEditMode
  staticBoundariesByFieldId?: Record<string, number[][]>
  selectedFieldId?: string | null
  editingRingNorm?: number[][] | null
  draftNewRingNorm?: number[][] | null
  onSelectFieldForEdit?: (fieldId: string | null, initialRingNorm: number[][] | null) => void
  onEditingRingChange?: (ringNorm: number[][]) => void
  onDraftNewRingChange?: (ringNorm: number[][]) => void
  onDraftNewRingComplete?: (ringNorm: number[][]) => void
}

const CROP_COLORS: Record<string, string> = {
  Corn: '#e6b800',
  Soy: '#2d5a27',
  Wheat: '#c4a35a',
  Other: '#888',
}

const PROFIT_COLORS = { positive: '#2d5a27', negative: '#b33' }

type Point = { x: number; y: number }

function projectToWebMercator(lng: number, lat: number): Point {
  const clampedLat = Math.max(Math.min(lat, 85.05112878), -85.05112878)
  const x = (lng + 180) / 360
  const rad = (clampedLat * Math.PI) / 180
  const y = 0.5 - Math.log((1 + Math.sin(rad)) / (1 - Math.sin(rad))) / (4 * Math.PI)
  return { x, y }
}

function createLonLatToPixel(snapshot: SnapshotConfig) {
  const { west, south, east, north } = snapshot.bbox
  const sw = projectToWebMercator(west, south)
  const ne = projectToWebMercator(east, north)
  const minX = sw.x
  const maxX = ne.x
  const minY = ne.y
  const maxY = sw.y
  const dx = maxX - minX || 1e-9
  const dy = maxY - minY || 1e-9

  return (lng: number, lat: number): Point => {
    const p = projectToWebMercator(lng, lat)
    const u = (p.x - minX) / dx
    const v = (p.y - minY) / dy
    return {
      x: u * snapshot.width,
      y: v * snapshot.height,
    }
  }
}

function ringNormToPixels(ringNorm: number[][], width: number, height: number): Point[] {
  return ringNorm.map(([nx, ny]) => ({ x: nx * width, y: ny * height }))
}

function ringPixelsToNorm(points: Point[], width: number, height: number): number[][] {
  const w = width || 1
  const h = height || 1
  return points.map((p) => [p.x / w, p.y / h])
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

export default function DashboardSnapshotView({
  snapshot,
  fields,
  pnlByFieldId = {},
  colorBy = 'crop',
  onFieldSelect,
  mode = 'view',
  staticBoundariesByFieldId = {},
  selectedFieldId = null,
  editingRingNorm = null,
  draftNewRingNorm = null,
  onSelectFieldForEdit,
  onEditingRingChange,
  onDraftNewRingChange,
  onDraftNewRingComplete,
}: DashboardSnapshotViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const [dragVertexIdx, setDragVertexIdx] = useState<number | null>(null)

  const toPixel = useMemo(() => createLonLatToPixel(snapshot), [snapshot])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [snapshot.image_url])

  const clampOffset = (next: { x: number; y: number }) => {
    const baseWidth = containerSize.width || snapshot.width
    const baseHeight = containerSize.height || snapshot.height
    const imgWidth = baseWidth * scale
    const imgHeight = baseHeight * scale
    const cw = containerSize.width || imgWidth
    const ch = containerSize.height || imgHeight
    const minX = Math.min(0, cw - imgWidth)
    const maxX = 0
    const minY = Math.min(0, ch - imgHeight)
    const maxY = 0
    return {
      x: Math.max(minX, Math.min(maxX, next.x)),
      y: Math.max(minY, Math.min(maxY, next.y)),
    }
  }

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    const delta = -e.deltaY
    const zoomFactor = delta > 0 ? 1.1 : 0.9
    const nextScale = Math.min(3, Math.max(1, scale * zoomFactor))
    if (nextScale === scale) return
    setScale(nextScale)
    setOffset((prev) => clampOffset(prev))
  }

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return
    if (mode !== 'view') return
    setIsPanning(true)
    panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!isPanning || !panStartRef.current) return
    const next = { x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y }
    setOffset(clampOffset(next))
  }

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    setIsPanning(false)
    panStartRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const getEventNorm = (e: React.PointerEvent) => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / (rect.width || 1)
    const ny = (e.clientY - rect.top) / (rect.height || 1)
    return { nx: clamp01(nx), ny: clamp01(ny) }
  }

  const projectedFields = useMemo(() => {
    return fields
      .map((f) => {
        const staticRing = staticBoundariesByFieldId[f.id]

        let points: Point[] | null = null
        if (staticRing && staticRing.length >= 3) {
          points = ringNormToPixels(staticRing, snapshot.width, snapshot.height)
        } else if (f.boundary && typeof f.boundary === 'object' && 'coordinates' in f.boundary) {
          const polygon = f.boundary as GeoJSON.Polygon
          const ring = polygon.coordinates[0] ?? []
          points = ring.map(([lng, lat]) => toPixel(lng, lat))
        }

        if (!points || points.length < 3) return null

        const pnl = pnlByFieldId[f.id]
        const profitClass = pnl ? (pnl.net_income >= 0 ? 'positive' : 'negative') : null
        let fill = CROP_COLORS.Other
        if (colorBy === 'profit') {
          fill =
            profitClass === 'positive'
              ? PROFIT_COLORS.positive
              : profitClass === 'negative'
                ? PROFIT_COLORS.negative
                : '#888'
        } else {
          const crop = f.crop_type ?? 'Other'
          fill = CROP_COLORS[crop] ?? CROP_COLORS.Other
        }
        return {
          field: f,
          points,
          fill,
          hasStatic: !!staticRing,
        }
      })
      .filter((f): f is { field: FieldWithCrop; points: Point[]; fill: string; hasStatic: boolean } => !!f)
  }, [fields, pnlByFieldId, colorBy, toPixel, staticBoundariesByFieldId, snapshot.width, snapshot.height])

  const selectedFieldPixels = useMemo(() => {
    if (!selectedFieldId) return null
    const ringNorm = editingRingNorm ?? staticBoundariesByFieldId[selectedFieldId] ?? null
    if (!ringNorm) return null
    return ringNormToPixels(ringNorm, snapshot.width, snapshot.height)
  }, [selectedFieldId, editingRingNorm, staticBoundariesByFieldId, snapshot.width, snapshot.height])

  const handlePolygonActivate = (field: Field, points: Point[]) => {
    if (mode === 'view') {
      onFieldSelect(field)
      return
    }
    if (mode === 'edit_boundary') {
      const staticRing = staticBoundariesByFieldId[field.id]
      const initialRingNorm =
        staticRing ??
        ringPixelsToNorm(points, snapshot.width, snapshot.height).map(([nx, ny]) => [clamp01(nx), clamp01(ny)])
      onSelectFieldForEdit?.(field.id, initialRingNorm)
    }
  }

  const handleSvgPointerDown: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (mode !== 'edit_boundary') return
    if (dragVertexIdx == null) return
    ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
  }

  const handleSvgPointerMove: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (mode !== 'edit_boundary') return
    if (dragVertexIdx == null || !editingRingNorm || !onEditingRingChange) return
    const norm = getEventNorm(e)
    if (!norm) return
    const next = editingRingNorm.map((p, idx) => (idx === dragVertexIdx ? [norm.nx, norm.ny] : p))
    onEditingRingChange(next)
  }

  const handleSvgPointerUp: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (mode !== 'edit_boundary') return
    setDragVertexIdx(null)
    try {
      ;(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleSvgTapToDraw: React.PointerEventHandler<SVGSVGElement> = (e) => {
    if (mode !== 'draw_new_field' || !onDraftNewRingChange) return
    const norm = getEventNorm(e)
    if (!norm) return
    const current = draftNewRingNorm ?? []
    if (current.length >= 3) {
      const [fx, fy] = current[0]
      const dx = norm.nx - fx
      const dy = norm.ny - fy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.02) {
        onDraftNewRingComplete?.(current)
        return
      }
    }
    onDraftNewRingChange([...current, [norm.nx, norm.ny]])
  }

  return (
    <div
      ref={containerRef}
      className="snapshot-map-container"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        touchAction: 'none',
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      aria-label="Farm overview snapshot"
    >
      <div
        className="snapshot-map-inner"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <img
          src={snapshot.image_url}
          alt="Farm dashboard snapshot"
          style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${snapshot.width} ${snapshot.height}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
          onPointerUpCapture={handleSvgTapToDraw}
        >
          {projectedFields.map(({ field, points, fill }) => (
            <polygon
              key={field.id}
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={fill}
              fillOpacity={0.5}
              stroke="#1a3c34"
              strokeWidth={2}
              onClick={(ev) => {
                ev.stopPropagation()
                handlePolygonActivate(field, points)
              }}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {mode === 'draw_new_field' && (draftNewRingNorm?.length ?? 0) >= 1 && (
            <polyline
              points={ringNormToPixels(draftNewRingNorm ?? [], snapshot.width, snapshot.height)
                .map((p) => `${p.x},${p.y}`)
                .join(' ')}
              fill="none"
              stroke="#fff"
              strokeWidth={2}
            />
          )}

          {mode === 'edit_boundary' && selectedFieldId && selectedFieldPixels && (
            <>
              {selectedFieldPixels.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={6}
                  fill="#fff"
                  stroke="#1a3c34"
                  strokeWidth={2}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation()
                    setDragVertexIdx(idx)
                    svgRef.current?.setPointerCapture(ev.pointerId)
                  }}
                />
              ))}
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

