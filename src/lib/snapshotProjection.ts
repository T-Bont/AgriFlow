export type SnapshotBbox = {
  west: number
  south: number
  east: number
  north: number
}

export type SnapshotConfigLike = {
  bbox: SnapshotBbox
  width: number
  height: number
}

type Point = { x: number; y: number }

function clampLat(lat: number) {
  return Math.max(Math.min(lat, 85.05112878), -85.05112878)
}

function projectToWebMercator(lng: number, lat: number): Point {
  const x = (lng + 180) / 360
  const rad = (clampLat(lat) * Math.PI) / 180
  const y = 0.5 - Math.log((1 + Math.sin(rad)) / (1 - Math.sin(rad))) / (4 * Math.PI)
  return { x, y }
}

export function projectLngLatToSnapshotPixels(snapshot: SnapshotConfigLike, lng: number, lat: number): Point {
  const { west, south, east, north } = snapshot.bbox
  const sw = projectToWebMercator(west, south)
  const ne = projectToWebMercator(east, north)
  const minX = sw.x
  const maxX = ne.x
  const minY = ne.y
  const maxY = sw.y
  const dx = maxX - minX || 1e-9
  const dy = maxY - minY || 1e-9

  const p = projectToWebMercator(lng, lat)
  const u = (p.x - minX) / dx
  const v = (p.y - minY) / dy
  return { x: u * snapshot.width, y: v * snapshot.height }
}

export function projectPolygonToRingNorm(
  snapshot: SnapshotConfigLike,
  polygon: GeoJSON.Polygon,
): number[][] {
  const ring = polygon.coordinates?.[0] ?? []
  if (!ring || ring.length < 3) return []
  return ring.map(([lng, lat]) => {
    const { x, y } = projectLngLatToSnapshotPixels(snapshot, lng, lat)
    const nx = x / (snapshot.width || 1)
    const ny = y / (snapshot.height || 1)
    return [Math.max(0, Math.min(1, nx)), Math.max(0, Math.min(1, ny))]
  })
}

