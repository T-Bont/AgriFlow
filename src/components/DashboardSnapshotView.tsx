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

interface DashboardSnapshotViewProps {
  snapshot: SnapshotConfig
  fields: FieldWithCrop[]
  pnlByFieldId?: Record<string, Pick<FieldPnlRow, 'net_income'>>
  colorBy?: MapColorBy
  onFieldSelect: (field: Field) => void
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

function createLonLatToPixel(snapshot: SnapshotConfig, width: number, height: number) {
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
      x: u * width,
      y: v * height,
    }
  }
}

export default function DashboardSnapshotView({
  snapshot,
  fields,
  pnlByFieldId = {},
  colorBy = 'crop',
  onFieldSelect,
}: DashboardSnapshotViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)

  const displayWidth = containerSize.width || snapshot.width
  const displayHeight = containerSize.height || snapshot.height

  const toPixel = useMemo(
    () => createLonLatToPixel(snapshot, displayWidth, displayHeight),
    [snapshot, displayWidth, displayHeight],
  )

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setContainerSize({ width: rect.width, height: rect.height })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e0eb3075-882d-4987-a8a6-bc15874059b1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '96d0fb',
        },
        body: JSON.stringify({
          sessionId: '96d0fb',
          runId: 'snapshot-debug',
          hypothesisId: 'H-size',
          location: 'src/components/DashboardSnapshotView.tsx:updateSize',
          message: 'snapshot container size',
          data: { width: rect.width, height: rect.height },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
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
    const imgWidth = displayWidth * scale
    const imgHeight = displayHeight * scale
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

  const projectedFields = useMemo(() => {
    return fields
      .filter((f) => f.boundary && typeof f.boundary === 'object' && 'coordinates' in f.boundary)
      .map((f) => {
        const polygon = f.boundary as GeoJSON.Polygon
        const ring = polygon.coordinates[0] ?? []
        const points: Point[] = ring.map(([lng, lat]) => toPixel(lng, lat))
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
        }
      })
      .filter((f) => f.points.length >= 3)
  }, [fields, pnlByFieldId, colorBy, toPixel])

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
          viewBox={`0 0 ${displayWidth} ${displayHeight}`}
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {projectedFields.map(({ field, points, fill }) => (
            <polygon
              key={field.id}
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={fill}
              fillOpacity={0.5}
              stroke="#1a3c34"
              strokeWidth={2}
              onClick={() => onFieldSelect(field)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}

