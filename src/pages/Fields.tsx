import { FormEvent, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import FieldList from '@/components/FieldList'
import { useFields } from '@/hooks/useFields'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import type { Field } from '@/types/database'
import { useProfile } from '@/hooks/useProfile'
import { useDashboardSnapshots } from '@/hooks/useDashboardSnapshots'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useDashboardSnapshotBoundaries } from '@/hooks/useDashboardSnapshotBoundaries'
import { projectPolygonToRingNorm } from '@/lib/snapshotProjection'
import { useMapShellFieldUi, useMapShellMapUi } from '@/stores/mapShell'
import './Fields.css'

export default function Fields() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { snapshots } = useDashboardSnapshots()
  const { user } = useAuth()
  const { fields, isLoading: fieldsLoading, createField } = useFields()
  const { data: pnlRows = [] } = useFieldPnl()

  const selectedSnapshotId = useMapShellMapUi((s) => s.selectedSnapshotId)
  const mapSeasonYear = useMapShellMapUi((s) => s.mapSeasonYear)

  const showAddField = useMapShellFieldUi((s) => s.showAddField)
  const newName = useMapShellFieldUi((s) => s.newName)
  const newAcres = useMapShellFieldUi((s) => s.newAcres)
  const draftBoundary = useMapShellFieldUi((s) => s.draftBoundary)
  const draftGisAcres = useMapShellFieldUi((s) => s.draftGisAcres)
  const setNewName = useMapShellFieldUi((s) => s.setNewName)
  const setNewAcres = useMapShellFieldUi((s) => s.setNewAcres)
  const resetAddFieldDraft = useMapShellFieldUi((s) => s.resetAddFieldDraft)
  const requestFieldFlow = useMapShellFieldUi((s) => s.requestFieldFlow)

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
  const snapshotId = snapshot?.snapshot_id ?? null

  const { refetch: refetchStaticBoundaries } = useDashboardSnapshotBoundaries(snapshotId)

  const availableYears = useMemo(
    () => [...new Set(pnlRows.map((r) => r.year))].sort((a, b) => b - a),
    [pnlRows],
  )
  const effectiveMapYear = mapSeasonYear ?? availableYears[0] ?? null

  const pnlRowsForSeason = useMemo(
    () =>
      effectiveMapYear != null ? pnlRows.filter((r) => r.year === effectiveMapYear) : pnlRows,
    [pnlRows, effectiveMapYear],
  )

  const handleFieldSelect = (field: Field) => {
    navigate(`/field/${field.id}`)
  }

  const handleAddField = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    const creatingFromStatic = !!useMapShellFieldUi.getState().draftStaticRingNorm
    const draftStaticRingNorm = useMapShellFieldUi.getState().draftStaticRingNorm
    const created = await createField.mutateAsync({
      name: newName.trim(),
      acres: newAcres ? parseFloat(newAcres) : draftGisAcres ?? undefined,
      boundary: creatingFromStatic ? undefined : (draftBoundary ?? undefined),
      gis_acres: creatingFromStatic ? undefined : (draftGisAcres ?? undefined),
    })

    if (user?.id && snapshotId) {
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
    resetAddFieldDraft()
  }

  const cancelAddField = () => {
    resetAddFieldDraft()
  }

  return (
    <div className="fields-panel">
      {fieldsLoading ? (
        <p className="muted">Loading fields…</p>
      ) : (
        <FieldList fields={fields} pnlRows={pnlRowsForSeason} onSelect={handleFieldSelect} />
      )}
      {showAddField ? (
        <form onSubmit={handleAddField} className="add-field-form">
          {draftBoundary && (
            <p className="muted add-field-drawn-hint">
              Boundary drawn. Acres from map: {draftGisAcres?.toFixed(2) ?? '—'}
            </p>
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
          <button type="button" className="btn-outline" onClick={() => requestFieldFlow('add')}>
            + Add field
          </button>
          <button type="button" className="btn-outline" onClick={() => requestFieldFlow('draw')}>
            Draw new field
          </button>
        </div>
      )}
    </div>
  )
}
