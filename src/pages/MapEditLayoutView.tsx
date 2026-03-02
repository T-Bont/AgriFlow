import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MapView, { type MapColorBy, type MapViewHandle } from '@/components/MapView'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import { useProfile } from '@/hooks/useProfile'
import type { Field } from '@/types/database'
import { supabase } from '@/lib/supabase'
import './Dashboard.css'

export default function MapEditLayoutView() {
  const navigate = useNavigate()
  const { refetch: refetchProfile } = useProfile()
  const { fields } = useFields()
  const { data: pnlRows = [] } = useFieldPnl()
  const [mapColorBy, setMapColorBy] = useState<MapColorBy>('crop')
  const [isSavingView, setIsSavingView] = useState(false)
  const mapRef = useRef<MapViewHandle | null>(null)

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
      const { bbox, camera, size } = view
      // Use the live map's exact CSS pixel size so the Static Images API matches the user's framing.
      const width = Math.min(1280, Math.max(320, size.width))
      const height = Math.min(1280, Math.max(320, size.height))
      const { error } = await supabase.functions.invoke('dashboard_snapshot', {
        body: {
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
      await refetchProfile()
      alert('Dashboard view updated.')
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
            {isSavingView ? 'Saving view…' : 'Establish dashboard view'}
          </button>
        </div>
      </section>
    </div>
  )
}

