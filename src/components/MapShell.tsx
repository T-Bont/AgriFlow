import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import MapView from '@/components/MapView'
import DashboardSnapshotView, { type SnapshotEditMode } from '@/components/DashboardSnapshotView'
import type { Field } from '@/types/database'
import { useProfile } from '@/hooks/useProfile'
import { useDashboardSnapshots } from '@/hooks/useDashboardSnapshots'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useDashboardSnapshotBoundaries } from '@/hooks/useDashboardSnapshotBoundaries'
import { useMapShellFieldUi, useMapShellMapUi } from '@/stores/mapShell'
import './MapShell.css'

export default function MapShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const isMapHome =
    location.pathname === '/' || location.pathname === ''

  const { profile } = useProfile()
  const { snapshots, setCurrentSnapshotId } = useDashboardSnapshots()
  const { user } = useAuth()
  const { fields, updateField } = useFields()
  const { data: pnlRows = [] } = useFieldPnl()

  const mapColorBy = useMapShellMapUi((s) => s.mapColorBy)
  const setMapColorBy = useMapShellMapUi((s) => s.setMapColorBy)
  const mapSeasonYear = useMapShellMapUi((s) => s.mapSeasonYear)
  const setMapSeasonYear = useMapShellMapUi((s) => s.setMapSeasonYear)
  const useLiveMap = useMapShellMapUi((s) => s.useLiveMap)
  const setUseLiveMap = useMapShellMapUi((s) => s.setUseLiveMap)
  const selectedSnapshotId = useMapShellMapUi((s) => s.selectedSnapshotId)
  const setSelectedSnapshotIdStore = useMapShellMapUi((s) => s.setSelectedSnapshotId)

  const fieldFlowNonce = useMapShellFieldUi((s) => s.fieldFlowNonce)
  const clearPendingFieldFlow = useMapShellFieldUi((s) => s.clearPendingFieldFlow)

  const setShowAddField = useMapShellFieldUi((s) => s.setShowAddField)
  const setNewAcres = useMapShellFieldUi((s) => s.setNewAcres)
  const setDraftBoundary = useMapShellFieldUi((s) => s.setDraftBoundary)
  const setDraftGisAcres = useMapShellFieldUi((s) => s.setDraftGisAcres)
  const setDraftStaticRingNorm = useMapShellFieldUi((s) => s.setDraftStaticRingNorm)
  const draftStaticRingNorm = useMapShellFieldUi((s) => s.draftStaticRingNorm)

  const [drawModeForNewField, setDrawModeForNewField] = useState(false)
  const [snapshotMode, setSnapshotMode] = useState<SnapshotEditMode>('view')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [editingRingNorm, setEditingRingNorm] = useState<number[][] | null>(null)
  const [liveBoundaryEditMode, setLiveBoundaryEditMode] = useState(false)
  const [editingLiveFieldId, setEditingLiveFieldId] = useState<string | null>(null)
  const [editingLiveBoundary, setEditingLiveBoundary] = useState<GeoJSON.Polygon | null>(null)
  const [editingLiveGisAcres, setEditingLiveGisAcres] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const [showMobileEditHint, setShowMobileEditHint] = useState(false)
  const [showMobileAddViewHint, setShowMobileAddViewHint] = useState(false)
  const [showFieldViewWarning, setShowFieldViewWarning] = useState(false)
  const [pendingFieldAction, setPendingFieldAction] = useState<'add' | 'draw' | null>(null)

  const legacySnapshot = profile?.settings?.dashboard_snapshot ?? null
  const activeSnapshotRow = useMemo(
    () => snapshots.find((s) => s.id === selectedSnapshotId) ?? null,
    [snapshots, selectedSnapshotId],
  )
  const snapshot = activeSnapshotRow
    ? {
        snapshot_id: activeSnapshotRow.id,
        bbox: activeSnapshotRow.bbox as { west: number; south: number; east: number; north: number },
        image_url: activeSnapshotRow.image_url,
        width: activeSnapshotRow.width,
        height: activeSnapshotRow.height,
        scale: activeSnapshotRow.scale ?? undefined,
        created_at: activeSnapshotRow.created_at,
      }
    : legacySnapshot
  const hasSnapshot = !!snapshot
  const showSnapshot = hasSnapshot && !useLiveMap
  const snapshotId = snapshot?.snapshot_id ?? null

  const { data: staticBoundaryRows = [], refetch: refetchStaticBoundaries } =
    useDashboardSnapshotBoundaries(snapshotId)

  const staticBoundariesByFieldId = useMemo(() => {
    const map: Record<string, number[][]> = {}
    for (const row of staticBoundaryRows) {
      map[row.field_id] = row.ring_norm
    }
    return map
  }, [staticBoundaryRows])

  const availableYears = useMemo(
    () => [...new Set(pnlRows.map((r) => r.year))].sort((a, b) => b - a),
    [pnlRows],
  )
  const effectiveMapYear = mapSeasonYear ?? availableYears[0] ?? null

  const fieldsWithCrop = useMemo(
    () =>
      fields.map((f) => ({
        ...f,
        crop_type:
          effectiveMapYear != null
            ? (pnlRows.find((r) => r.field_id === f.id && r.year === effectiveMapYear)?.crop_type ?? 'Other')
            : (pnlRows.find((r) => r.field_id === f.id)?.crop_type ?? 'Other'),
      })),
    [fields, pnlRows, effectiveMapYear],
  )

  const pnlByFieldId = useMemo(() => {
    if (effectiveMapYear != null) {
      return Object.fromEntries(
        pnlRows
          .filter((r) => r.year === effectiveMapYear)
          .map((r) => [r.field_id, { net_income: r.net_income }]),
      )
    }
    const withYear = pnlRows.reduce<Record<string, { net_income: number; year: number }>>((acc, r) => {
      if (acc[r.field_id] == null || r.year > acc[r.field_id].year) {
        acc[r.field_id] = { net_income: r.net_income, year: r.year }
      }
      return acc
    }, {})
    return Object.fromEntries(
      Object.entries(withYear).map(([k, v]) => [k, { net_income: v.net_income }]),
    )
  }, [pnlRows, effectiveMapYear])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const showEditControls = !isMobile && isMapHome

  useEffect(() => {
    if (selectedSnapshotId) return
    const preferredId =
      profile?.settings?.dashboard_default_snapshot_id ??
      profile?.settings?.dashboard_current_snapshot_id ??
      profile?.settings?.dashboard_snapshot?.snapshot_id ??
      null
    if (preferredId && snapshots.some((s) => s.id === preferredId)) {
      setSelectedSnapshotIdStore(preferredId)
      return
    }
    if (snapshots.length > 0) {
      setSelectedSnapshotIdStore(snapshots[0].id)
    }
  }, [profile, selectedSnapshotId, snapshots, setSelectedSnapshotIdStore])

  useEffect(() => {
    if (!showMobileEditHint) return
    const timeoutId = window.setTimeout(() => setShowMobileEditHint(false), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [showMobileEditHint])

  useEffect(() => {
    if (!showMobileAddViewHint) return
    const timeoutId = window.setTimeout(() => setShowMobileAddViewHint(false), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [showMobileAddViewHint])

  useEffect(() => {
    if (!showSnapshot) return
    if (!liveBoundaryEditMode) return
    setLiveBoundaryEditMode(false)
    setEditingLiveFieldId(null)
    setEditingLiveBoundary(null)
    setEditingLiveGisAcres(null)
  }, [showSnapshot, liveBoundaryEditMode])

  /** Fields panel requests add/draw — open confirmation modal */
  useEffect(() => {
    if (fieldFlowNonce === 0) return
    const type = useMapShellFieldUi.getState().pendingFieldFlow
    if (!type) return
    clearPendingFieldFlow()
    setPendingFieldAction(type)
    setShowFieldViewWarning(true)
  }, [fieldFlowNonce, clearPendingFieldFlow])

  const handleFieldSelect = (field: Field) => {
    navigate(`/field/${field.id}`)
  }

  const handleBoundaryDrawn = (boundary: GeoJSON.Polygon, gisAcres: number) => {
    setDraftBoundary(boundary)
    setDraftGisAcres(gisAcres)
    setDrawModeForNewField(false)
    setShowAddField(true)
    setNewAcres(gisAcres.toFixed(2))
  }

  const requestFieldAction = (action: 'add' | 'draw') => {
    setPendingFieldAction(action)
    setShowFieldViewWarning(true)
  }

  const cancelFieldActionWarning = () => {
    setShowFieldViewWarning(false)
    setPendingFieldAction(null)
  }

  const confirmFieldActionWarning = () => {
    if (pendingFieldAction === 'add') {
      setShowAddField(true)
    } else if (pendingFieldAction === 'draw') {
      if (showSnapshot) {
        setUseLiveMap(true)
      }
      setDrawModeForNewField(true)
    }
    cancelFieldActionWarning()
  }

  const cancelSnapshotEdit = () => {
    setSnapshotMode('view')
    setSelectedFieldId(null)
    setEditingRingNorm(null)
    setDraftStaticRingNorm(null)
    setLiveBoundaryEditMode(false)
    setEditingLiveFieldId(null)
    setEditingLiveBoundary(null)
    setEditingLiveGisAcres(null)
  }

  const saveEditedBoundary = async () => {
    if (!user?.id || !snapshotId || !selectedFieldId || !editingRingNorm) return
    await supabase
      .from('dashboard_snapshot_field_boundaries')
      .upsert(
        {
          user_id: user.id,
          snapshot_id: snapshotId,
          field_id: selectedFieldId,
          ring_norm: editingRingNorm,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'snapshot_id,field_id' },
      )
    await refetchStaticBoundaries()
    cancelSnapshotEdit()
  }

  const saveLiveEditedBoundary = async () => {
    if (!editingLiveFieldId || !editingLiveBoundary) return
    await updateField.mutateAsync({
      id: editingLiveFieldId,
      payload: {
        boundary: editingLiveBoundary,
        gis_acres: editingLiveGisAcres ?? undefined,
      },
    })
    cancelSnapshotEdit()
  }

  const cancelDrawNewField = () => {
    setDrawModeForNewField(false)
    setDraftBoundary(null)
    setDraftGisAcres(null)
    setDraftStaticRingNorm(null)
  }

  return (
    <div className="map-shell">
      <section className="satellite-dashboard" aria-label="Satellite map">
        <div className="satellite-dashboard-map">
          {showSnapshot && snapshot ? (
            <DashboardSnapshotView
              snapshot={snapshot}
              fields={fieldsWithCrop}
              pnlByFieldId={mapColorBy === 'profit' ? pnlByFieldId : undefined}
              colorBy={mapColorBy}
              onFieldSelect={handleFieldSelect}
              mode={snapshotMode}
              staticBoundariesByFieldId={staticBoundariesByFieldId}
              selectedFieldId={selectedFieldId}
              editingRingNorm={editingRingNorm}
              draftNewRingNorm={snapshotMode === 'draw_new_field' ? draftStaticRingNorm : null}
              onSelectFieldForEdit={(id, initial) => {
                setSelectedFieldId(id)
                setEditingRingNorm(initial)
              }}
              onEditingRingChange={(ring) => setEditingRingNorm(ring)}
              onDraftNewRingChange={(ring) => setDraftStaticRingNorm(ring)}
              onDraftNewRingComplete={(ring) => {
                setDraftStaticRingNorm(ring)
                setSnapshotMode('view')
                setShowAddField(true)
                setNewAcres('')
              }}
            />
          ) : (
            <MapView
              fields={fieldsWithCrop}
              onFieldSelect={liveBoundaryEditMode ? () => {} : handleFieldSelect}
              colorBy={mapColorBy}
              pnlByFieldId={mapColorBy === 'profit' ? pnlByFieldId : undefined}
              initialCenter={profile?.settings?.dashboard_camera?.center ?? undefined}
              initialZoom={profile?.settings?.dashboard_camera?.zoom ?? undefined}
              fitBoundsToFields={!profile?.settings?.dashboard_camera}
              drawMode={drawModeForNewField}
              onBoundaryDrawn={drawModeForNewField ? handleBoundaryDrawn : undefined}
              editBoundaryMode={liveBoundaryEditMode}
              onBoundaryEdited={(fieldId, boundary, gisAcres) => {
                setEditingLiveFieldId(fieldId)
                setEditingLiveBoundary(boundary)
                setEditingLiveGisAcres(gisAcres)
              }}
            />
          )}
        </div>
        {isMapHome && (
          <div className="satellite-dashboard-toggles">
            {isMobile && (
              <button
                type="button"
                className="satellite-edit-toggle"
                onClick={() => setShowMobileEditHint(true)}
              >
                Edit
              </button>
            )}
            {isMobile && showMobileEditHint && (
              <span className="satellite-mobile-edit-hint">Edit fields on computer</span>
            )}
            <div className={`mobile-edit-actions${showEditControls ? '' : ' hidden'}`}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  const snapshotIdParam = selectedSnapshotId ? `?snapshot_id=${selectedSnapshotId}` : ''
                  navigate(`/map/edit${snapshotIdParam}`)
                }}
              >
                Establish Dashboard View
              </button>
              <button type="button" className="btn-outline" onClick={() => requestFieldAction('draw')}>
                Draw new field
              </button>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  if (showSnapshot) {
                    setSnapshotMode('edit_boundary')
                    setSelectedFieldId(null)
                    setEditingRingNorm(null)
                    setLiveBoundaryEditMode(false)
                    setEditingLiveFieldId(null)
                    setEditingLiveBoundary(null)
                    setEditingLiveGisAcres(null)
                    return
                  }
                  setLiveBoundaryEditMode(true)
                  setSnapshotMode('view')
                  setSelectedFieldId(null)
                  setEditingRingNorm(null)
                  setEditingLiveFieldId(null)
                  setEditingLiveBoundary(null)
                  setEditingLiveGisAcres(null)
                }}
              >
                Edit field boundary
              </button>
            </div>
            {(snapshotMode !== 'view' || liveBoundaryEditMode) && (
              <>
                <span className="satellite-dashboard-label">
                  {snapshotMode === 'draw_new_field'
                    ? 'Tap points to outline a field. Tap near the first point to finish.'
                    : 'Select a field, then drag points to adjust.'}
                </span>
                <button type="button" className="btn-outline" onClick={cancelSnapshotEdit}>
                  Cancel
                </button>
                {(snapshotMode === 'edit_boundary' || liveBoundaryEditMode) && (
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={
                      snapshotMode === 'edit_boundary'
                        ? !selectedFieldId || !editingRingNorm
                        : !editingLiveFieldId || !editingLiveBoundary
                    }
                    onClick={snapshotMode === 'edit_boundary' ? saveEditedBoundary : saveLiveEditedBoundary}
                  >
                    Save boundary
                  </button>
                )}
              </>
            )}
            {drawModeForNewField && (
              <>
                <span className="satellite-dashboard-label">
                  Draw a polygon on the map, then name the field below.
                </span>
                <button type="button" className="btn-outline" onClick={cancelDrawNewField}>
                  Cancel
                </button>
              </>
            )}
            {availableYears.length > 0 && (
              <>
                <span className="satellite-dashboard-label">Season:</span>
                <select
                  className="satellite-dashboard-season"
                  value={mapSeasonYear ?? availableYears[0]}
                  onChange={(e) => setMapSeasonYear(Number(e.target.value))}
                  aria-label="Select season year"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}
            {snapshots.length > 0 && (
              <>
                <span className="satellite-dashboard-label">Current View:</span>
                <select
                  className="satellite-dashboard-season"
                  value={selectedSnapshotId ?? snapshots[0].id}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setSelectedSnapshotIdStore(nextId)
                    setCurrentSnapshotId.mutate(nextId)
                    setUseLiveMap(false)
                  }}
                  aria-label="Select current static dashboard view"
                >
                  {snapshots.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    if (isMobile) {
                      setShowMobileAddViewHint(true)
                      return
                    }
                    navigate('/map/edit?mode=create')
                  }}
                >
                  Add View
                </button>
                {isMobile && showMobileAddViewHint && (
                  <span className="satellite-mobile-edit-hint">Add view on computer</span>
                )}
              </>
            )}
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
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-outline"
                disabled={!hasSnapshot}
                onClick={() => setUseLiveMap((prev) => !prev)}
              >
                {useLiveMap ? 'Show static snapshot' : 'Show live map'}
              </button>
            </div>
          </div>
        )}
      </section>
      {showFieldViewWarning && (
        <div className="dashboard-modal-backdrop" role="presentation">
          <div className="dashboard-modal" role="dialog" aria-modal="true" aria-label="Field view confirmation">
            <p>Ensure view selected is where the new field will reside.</p>
            <div className="dashboard-modal-actions">
              <button type="button" onClick={confirmFieldActionWarning}>
                Confirm
              </button>
              <button type="button" className="btn-outline" onClick={cancelFieldActionWarning}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
