import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import MapView from '@/components/MapView'
import type { MapColorBy } from '@/components/MapView'
import DashboardSnapshotView, { type SnapshotEditMode } from '@/components/DashboardSnapshotView'
import FAB from '@/components/FAB'
import FieldList from '@/components/FieldList'
import type { Field } from '@/types/database'
import { useProfile } from '@/hooks/useProfile'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useDashboardSnapshotBoundaries } from '@/hooks/useDashboardSnapshotBoundaries'
import { projectPolygonToRingNorm } from '@/lib/snapshotProjection'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { user } = useAuth()
  const { fields, isLoading: fieldsLoading, createField } = useFields()
  const { data: pnlRows = [] } = useFieldPnl()
  const [showAddField, setShowAddField] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAcres, setNewAcres] = useState('')
  const [mapColorBy, setMapColorBy] = useState<MapColorBy>('crop')
  const [mapSeasonYear, setMapSeasonYear] = useState<number | null>(null)
  const [drawModeForNewField, setDrawModeForNewField] = useState(false)
  const [draftBoundary, setDraftBoundary] = useState<GeoJSON.Polygon | null>(null)
  const [draftGisAcres, setDraftGisAcres] = useState<number | null>(null)
  const [useLiveMap, setUseLiveMap] = useState(false)
  const [snapshotMode, setSnapshotMode] = useState<SnapshotEditMode>('view')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [editingRingNorm, setEditingRingNorm] = useState<number[][] | null>(null)
  const [draftStaticRingNorm, setDraftStaticRingNorm] = useState<number[][] | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const [mobileEditOpen, setMobileEditOpen] = useState(false)

  const hasSnapshot = !!profile?.settings?.dashboard_snapshot
  const snapshot = profile?.settings?.dashboard_snapshot ?? null
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

  /** PNL rows for the selected season year — used for map, leaderboard, and field list */
  const pnlRowsForSeason = useMemo(
    () =>
      effectiveMapYear != null ? pnlRows.filter((r) => r.year === effectiveMapYear) : pnlRows,
    [pnlRows, effectiveMapYear],
  )

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

  const showEditControls = !isMobile || mobileEditOpen

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

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const creatingFromStatic = !!draftStaticRingNorm
    const created = await createField.mutateAsync({
      name: newName.trim(),
      acres: newAcres ? parseFloat(newAcres) : draftGisAcres ?? undefined,
      boundary: creatingFromStatic ? undefined : (draftBoundary ?? undefined),
      gis_acres: creatingFromStatic ? undefined : (draftGisAcres ?? undefined),
    })

    if (user?.id && snapshotId) {
      // Seed or persist a static boundary for this snapshot:
      // - If the user drew on the static snapshot, use that ring.
      // - If they drew in live map, project the GeoJSON polygon into the snapshot and normalize.
      const ringNorm =
        draftStaticRingNorm ??
        (draftBoundary && snapshot
          ? projectPolygonToRingNorm(
              { bbox: snapshot.bbox, width: snapshot.width, height: snapshot.height },
              draftBoundary,
            )
          : null)

      if (ringNorm && ringNorm.length >= 3) {
        await supabase
          .from('dashboard_snapshot_field_boundaries')
          .upsert(
            {
              user_id: user.id,
              snapshot_id: snapshotId,
              field_id: created.id,
              ring_norm: ringNorm,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: 'snapshot_id,field_id' },
          )
        await refetchStaticBoundaries()
      }
    }
    setNewName('')
    setNewAcres('')
    setShowAddField(false)
    setDraftBoundary(null)
    setDraftGisAcres(null)
    setDraftStaticRingNorm(null)
  }

  const cancelAddField = () => {
    setShowAddField(false)
    setDrawModeForNewField(false)
    setDraftBoundary(null)
    setDraftGisAcres(null)
    setDraftStaticRingNorm(null)
  }

  const cancelSnapshotEdit = () => {
    setSnapshotMode('view')
    setSelectedFieldId(null)
    setEditingRingNorm(null)
    setDraftStaticRingNorm(null)
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

  return (
    <div className="dashboard-page">
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
              onFieldSelect={handleFieldSelect}
              colorBy={mapColorBy}
              pnlByFieldId={mapColorBy === 'profit' ? pnlByFieldId : undefined}
              initialCenter={
                profile?.settings?.dashboard_camera?.center ?? undefined
              }
              initialZoom={profile?.settings?.dashboard_camera?.zoom ?? undefined}
              fitBoundsToFields={!profile?.settings?.dashboard_camera}
              drawMode={drawModeForNewField}
              onBoundaryDrawn={drawModeForNewField ? handleBoundaryDrawn : undefined}
            />
          )}
        </div>
        <div className="satellite-dashboard-toggles">
          {isMobile && (
            <button
              type="button"
              className={`satellite-edit-toggle${mobileEditOpen ? ' active' : ''}`}
              onClick={() => setMobileEditOpen((prev) => !prev)}
            >
              Edit
            </button>
          )}
          <div className={`mobile-edit-actions${showEditControls ? '' : ' hidden'}`}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate('/map/edit')}
            >
              Edit field layout
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={showSnapshot}
              onClick={() => {
                if (!showSnapshot) {
                  setDrawModeForNewField(true)
                }
              }}
            >
              Draw new field
            </button>
            <button
              type="button"
              className="btn-outline"
              disabled={!showSnapshot}
              onClick={() => {
                setSnapshotMode('edit_boundary')
                setSelectedFieldId(null)
                setEditingRingNorm(null)
              }}
            >
              Edit field boundary
            </button>
          </div>
          {snapshotMode !== 'view' && (
            <>
              <span className="satellite-dashboard-label">
                {snapshotMode === 'draw_new_field'
                  ? 'Tap points to outline a field. Tap near the first point to finish.'
                  : 'Tap a field to select, then drag points to adjust.'}
              </span>
              <button type="button" className="btn-outline" onClick={cancelSnapshotEdit}>
                Cancel
              </button>
              {snapshotMode === 'edit_boundary' && (
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!selectedFieldId || !editingRingNorm}
                  onClick={saveEditedBoundary}
                >
                  Save boundary
                </button>
              )}
            </>
          )}
          {drawModeForNewField && (
            <span className="satellite-dashboard-label">Draw a polygon on the map, then name the field below.</span>
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
      </section>
      <section className="dashboard">
        <div className="dashboard-content">
        <section className="dashboard-section">
          <h2>Fields</h2>
          {fieldsLoading ? (
            <p className="muted">Loading fields…</p>
          ) : (
            <FieldList
              fields={fields}
              pnlRows={pnlRowsForSeason}
              onSelect={handleFieldSelect}
            />
          )}
          {showAddField ? (
            <form onSubmit={handleAddField} className="add-field-form">
              {draftBoundary && (
                <p className="muted add-field-drawn-hint">Boundary drawn. Acres from map: {draftGisAcres?.toFixed(2) ?? '—'}</p>
              )}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Field name"
                required
                autoFocus
              />
              <input
                type="number"
                step="0.1"
                min="0"
                value={newAcres}
                onChange={(e) => setNewAcres(e.target.value)}
                placeholder="Acres (optional)"
                inputMode="decimal"
              />
              <div className="add-field-actions">
                <button type="submit" disabled={createField.isPending}>
                  {createField.isPending ? 'Adding…' : 'Add'}
                </button>
                <button type="button" onClick={cancelAddField}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="add-field-buttons">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setShowAddField(true)}
              >
                + Add field
              </button>
            </div>
          )}
        </section>
        </div>
      </section>
      <FAB to="/log" />
    </div>
  )
}
