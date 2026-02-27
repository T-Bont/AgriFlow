const M2_PER_ACRE = 4046.86

/** Approximate polygon area in acres from GeoJSON coordinates (first ring only). */
export function polygonAcres(coordinates: number[][][]): number {
  const ring = coordinates[0]
  if (!ring || ring.length < 3) return 0
  const n = ring.length
  const latRad = (ring.reduce((s, p) => s + p[1], 0) / n) * (Math.PI / 180)
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos(latRad)
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const x1 = ring[i][0] * mPerDegLon
    const y1 = ring[i][1] * mPerDegLat
    const x2 = ring[j][0] * mPerDegLon
    const y2 = ring[j][1] * mPerDegLat
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2 / M2_PER_ACRE
}

/** Bounding box as [southwest, northeast] for Mapbox fitBounds, or null if no valid polygons. */
export function boundsFromPolygons(
  polygons: Array<{ coordinates?: number[][][] } | null | undefined>,
): [[number, number], [number, number]] | null {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  let hasAny = false
  for (const poly of polygons) {
    const ring = poly?.coordinates?.[0]
    if (!ring || !Array.isArray(ring)) continue
    for (const pt of ring) {
      const lng = Number(pt?.[0])
      const lat = Number(pt?.[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      hasAny = true
      if (lng < minLng) minLng = lng
      if (lat < minLat) minLat = lat
      if (lng > maxLng) maxLng = lng
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!hasAny || minLng > maxLng || minLat > maxLat) return null
  if (minLng === maxLng) {
    minLng -= 1e-5
    maxLng += 1e-5
  }
  if (minLat === maxLat) {
    minLat -= 1e-5
    maxLat += 1e-5
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
