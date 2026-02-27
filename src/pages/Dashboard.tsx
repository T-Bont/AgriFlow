import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import MapView from '@/components/MapView'
import type { MapColorBy } from '@/components/MapView'
import DashboardSnapshotView from '@/components/DashboardSnapshotView'
import FAB from '@/components/FAB'
import FieldList from '@/components/FieldList'
import type { Field } from '@/types/database'
import { useProfile } from '@/hooks/useProfile'
import './Dashboard.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useProfile()
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

  const hasSnapshot = !!profile?.settings?.dashboard_snapshot

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
    await createField.mutateAsync({
      name: newName.trim(),
      acres: newAcres ? parseFloat(newAcres) : draftGisAcres ?? undefined,
      boundary: draftBoundary ?? undefined,
      gis_acres: draftGisAcres ?? undefined,
    })
    setNewName('')
    setNewAcres('')
    setShowAddField(false)
    setDraftBoundary(null)
    setDraftGisAcres(null)
  }

  const cancelAddField = () => {
    setShowAddField(false)
    setDrawModeForNewField(false)
    setDraftBoundary(null)
    setDraftGisAcres(null)
  }

  return (
    <div className="dashboard-page">
      <section className="satellite-dashboard" aria-label="Satellite map">
        <div className="satellite-dashboard-map">
          {hasSnapshot && !useLiveMap ? (
            <DashboardSnapshotView
              snapshot={profile.settings.dashboard_snapshot}
              fields={fieldsWithCrop}
              pnlByFieldId={mapColorBy === 'profit' ? pnlByFieldId : undefined}
              colorBy={mapColorBy}
              onFieldSelect={handleFieldSelect}
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
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate('/map/edit')}
          >
            Edit field layout
          </button>
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
        {pnlRowsForSeason.length > 0 && (
          <section className="dashboard-section dashboard-leaderboard">
            <h2>Net income per acre</h2>
            <ul className="leaderboard">
              {(() => {
                const withPerAcre = pnlRowsForSeason.filter((r) => r.net_income_per_acre != null)
                const sorted = withPerAcre.length > 0
                  ? [...withPerAcre].sort((a, b) => (b.net_income_per_acre ?? 0) - (a.net_income_per_acre ?? 0))
                  : [...pnlRowsForSeason].sort((a, b) => b.net_income - a.net_income)
                return sorted.slice(0, 5).map((r) => (
                  <li key={r.season_id}>
                    <span className="leaderboard-name">{r.field_name}</span>
                    <span className={(r.net_income_per_acre ?? r.net_income) >= 0 ? 'positive' : 'negative'}>
                      {r.net_income_per_acre != null
                        ? `$${r.net_income_per_acre.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ac`
                        : `$${r.net_income.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </span>
                  </li>
                ))
              })()}
            </ul>
            {pnlRowsForSeason.every((r) => r.net_income_per_acre == null) && pnlRowsForSeason.length > 0 && (
              <p className="muted">Add acres to fields to see net income per acre.</p>
            )}
          </section>
        )}
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
              <button
                type="button"
                className="btn-outline"
                onClick={() => setDrawModeForNewField(true)}
              >
                Draw on map
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
