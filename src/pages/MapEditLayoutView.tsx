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
    const view = mapRef.current?.getCurrentView()
    if (!view) {
      alert('Map is not ready yet. Try again in a moment.')
      return
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e0eb3075-882d-4987-a8a6-bc15874059b1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '96d0fb',
      },
      body: JSON.stringify({
        sessionId: '96d0fb',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'src/pages/MapEditLayoutView.tsx:handleEstablishDashboardView',
        message: 'Establish dashboard view pressed',
        data: { bbox: view.bbox, camera: view.camera },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion agent log
    setIsSavingView(true)
    try {
      const { bbox, camera } = view
      const width = Math.min(1000, Math.max(400, window.innerWidth || 800))
      const height = Math.min(800, Math.max(300, Math.round((window.innerHeight || 600) * 0.5)))
      const { data, error } = await supabase.functions.invoke('dashboard_snapshot', {
        body: {
          bbox,
          width,
          height,
          scale: 2,
          camera,
        },
      })
      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e0eb3075-882d-4987-a8a6-bc15874059b1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Debug-Session-Id': '96d0fb',
          },
          body: JSON.stringify({
            sessionId: '96d0fb',
            runId: 'pre-fix',
            hypothesisId: 'H2',
            location: 'src/pages/MapEditLayoutView.tsx:handleEstablishDashboardView',
            message: 'dashboard_snapshot invoke error',
            data: { message: error.message, name: error.name },
            timestamp: Date.now(),
          }),
        }).catch(() => {})
        // #endregion agent log
        alert('Failed to establish dashboard view. Please try again.')
        return
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e0eb3075-882d-4987-a8a6-bc15874059b1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '96d0fb',
        },
        body: JSON.stringify({
          sessionId: '96d0fb',
          runId: 'pre-fix',
          hypothesisId: 'H3',
          location: 'src/pages/MapEditLayoutView.tsx:handleEstablishDashboardView',
          message: 'dashboard_snapshot invoke success',
          data: { hasData: !!data },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion agent log
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

