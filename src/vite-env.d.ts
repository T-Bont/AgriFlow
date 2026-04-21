/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MAPBOX_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@mapbox/mapbox-gl-draw' {
  const MapboxDraw: new (options?: Record<string, unknown>) => {
    add: (feature: GeoJSON.FeatureCollection | GeoJSON.Feature) => unknown
    getAll: () => { features: GeoJSON.Feature[] }
    deleteAll: () => void
  }
  export default MapboxDraw
}
