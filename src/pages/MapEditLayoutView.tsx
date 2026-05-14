import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MapView, { type MapColorBy, type MapViewHandle } from '@/components/MapView'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/contexts/AuthContext'
import type { Field } from '@/types/database'
import { supabase } from '@/lib/supabase'
import './MapEditLayoutView.css'

export default function MapEditLayoutView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { profile, refetch: refetchProfile } = useProfile()
  const { fields } = useFields()
  const { data: pnlRows = [] } = useFieldPnl()
  const [mapColorBy, setMapColorBy] = useState<MapColorBy>('crop')
  const [isSavingView, setIsSavingView] = useState(false)
  const mapRef = useRef<MapViewHandle | null>(null)
  const isCreateMode = searchParams.get('mode') === 'create'
  const forcedSnapshotId = searchParams.get('snapshot_id')

  const fieldsWithCrop = useMemo(
    () =>
      fields.map((f) => ({
        ...f,
        crop_type: pnlRows.find((r) => r.field_id === f.id)?.crop_type ?? 'Other',
      })),
    [fields, pnlRows],
  )

  const pnlByFieldId = useMemo(
    () =>
      Object.fromEntries(pnlRows.map((r) => [r.field_id, { net_income: r.net_income }])),
    [pnlRows],
  )

  const handleFieldSelect = (field: Field) => {
    navigate(`/field/${field.id}`)
  }

  const handleEstablishDashboardView = async () => {
    if (isSavingView) return
    const view = mapRef.current?.getSnapshotView()
    if (!view) {
      alert('Map is not ready yet. Try again in a moment.')
      return
    }
    setIsSavingView(true)
    try {
      let requestedName: string | undefined
      if (isCreateMode) {
        const input = window.prompt('Name this view', 'New view')
        if (input == null) return
        requestedName = input.trim() || 'Untitled view'
      }
      const { bbox, camera, size } = view
      // Use the live map's exact CSS pixel size so the Static Images API matches the user's framing.
      const width = Math.min(1280, Math.max(320, size.width))
      const height = Math.min(1280, Math.max(320, size.height))
      const activeSnapshotId =
        profile?.settings?.dashboard_current_snapshot_id ??
        profile?.settings?.dashboard_default_snapshot_id ??
        profile?.settings?.dashboard_snapshot?.snapshot_id
      const targetSnapshotId = isCreateMode ? undefined : forcedSnapshotId ?? activeSnapshotId
      const { data: invokeData, error } = await supabase.functions.invoke('dashboard_snapshot', {
        body: {
          mode: isCreateMode ? 'create' : 'update',
          snapshot_id: targetSnapshotId,
          name: requestedName,
          set_as_current: true,
          bbox,
          width,
          height,
          scale: 2,
          camera,
        },
      })
      if (error) {
        alert('Failed to establish dashboard view. Please try again.')
        return
      }

      const updatedSnapshotId = (invokeData as { snapshot_id?: string } | null)?.snapshot_id ?? targetSnapshotId

      // If we're updating an existing view, reproject all existing live field boundaries into the new snapshot bbox/size.
      // This overwrites stored `dashboard_snapshot_field_boundaries.ring_norm` so boundaries stay aligned after pan/zoom.
      if (!isCreateMode && updatedSnapshotId && user?.id) {
        const updatedAt = new Date().toISOString()
        const projector = mapRef.current?.projectLngLatToNorm
        type RingBoundaryUpsert = {
          user_id: string
          snapshot_id: string
          field_id: string
          ring_norm: number[][]
          updated_at: string
        }

        const ringUpserts = fields.reduce<RingBoundaryUpsert[]>((acc, f) => {
          if (!f.boundary || typeof f.boundary !== 'object') return acc
          if (!('coordinates' in f.boundary)) return acc
          if (!projector) return acc

          const polygon = f.boundary as GeoJSON.Polygon
          const ring = polygon.coordinates?.[0] ?? []
          if (!ring || ring.length < 3) return acc

          const ringNorm = ring
            .map(([lng, lat]) => projector(lng, lat))
            .filter((p): p is { nx: number; ny: number } => !!p)
            .map((p) => [p.nx, p.ny])

          if (ringNorm.length < 3) return acc

          acc.push({
            user_id: user.id,
            snapshot_id: updatedSnapshotId,
            field_id: f.id,
            ring_norm: ringNorm,
            updated_at: updatedAt,
          })
          return acc
        }, [])

        if (ringUpserts.length > 0) {
          await supabase
            .from('dashboard_snapshot_field_boundaries')
            .upsert(ringUpserts as never, { onConflict: 'snapshot_id,field_id' })
        }
      }

      qc.invalidateQueries({ queryKey: ['dashboard_snapshots', user?.id] })
      if (!isCreateMode && updatedSnapshotId) {
        qc.invalidateQueries({ queryKey: ['dashboard_snapshot_field_boundaries', user?.id, updatedSnapshotId] })
      }

      await refetchProfile()
      alert(isCreateMode ? 'Dashboard view created.' : 'Dashboard view updated.')
      navigate('/')
    } finally {
      setIsSavingView(false)
    }
  }

  return (
    <div className="dashboard-page">
      <section className="satellite-dashboard" aria-label="Map layout editor">
        <div className="satellite-dashboard-map">
          <MapView
            ref={mapRef}
            fields={fieldsWithCrop}
            onFieldSelect={handleFieldSelect}
            colorBy={mapColorBy}
            pnlByFieldId={mapColorBy === 'profit' ? pnlByFieldId : undefined}
            fitBoundsToFields
            northUp2D
          />
        </div>
        <div className="satellite-dashboard-toggles">
          <button type="button" className="btn-outline" onClick={() => navigate('/')}>
            ← Back to dashboard
          </button>
          <span className="satellite-dashboard-label">Color by:</span>
          <button
            type="button"
            className={mapColorBy === 'crop' ? 'active' : ''}
            onClick={() => setMapColorBy('crop')}
          >
            Crop
          </button>
          <button
            type="button"
            className={mapColorBy === 'profit' ? 'active' : ''}
            onClick={() => setMapColorBy('profit')}
          >
            Profit
          </button>
          <button
            type="button"
            className="btn-outline"
            disabled={isSavingView}
            onClick={handleEstablishDashboardView}
          >
            {isSavingView
              ? (isCreateMode ? 'Creating view…' : 'Saving view…')
              : (isCreateMode ? 'Create dashboard view' : 'Establish dashboard view')}
          </button>
        </div>
      </section>
    </div>
  )
}

