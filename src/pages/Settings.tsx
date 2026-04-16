import { useEffect, useState } from 'react'
import { useDashboardSnapshots } from '@/hooks/useDashboardSnapshots'
import { useProfile } from '@/hooks/useProfile'
import './Settings.css'

export default function Settings() {
  const { profile } = useProfile()
  const {
    snapshots,
    isLoading,
    renameSnapshot,
    deleteSnapshot,
    setCurrentSnapshotId,
    setDefaultSnapshotId,
  } = useDashboardSnapshots()
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})

  useEffect(() => {
    setDraftNames(Object.fromEntries(snapshots.map((s) => [s.id, s.name])))
  }, [snapshots])

  const defaultSnapshotId =
    profile?.settings?.dashboard_default_snapshot_id ??
    profile?.settings?.dashboard_current_snapshot_id ??
    snapshots[0]?.id ??
    null

  const canDelete = snapshots.length > 1

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2>Dashboard views</h2>
        {isLoading && <p className="muted">Loading views...</p>}
        {!isLoading && snapshots.length === 0 && (
          <p className="muted">No static dashboard views yet. Create one from Home using Add View.</p>
        )}
        {snapshots.length > 0 && (
          <>
            <label className="settings-default-view">
              <span>Default view</span>
              <select
                value={defaultSnapshotId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value || null
                  setDefaultSnapshotId.mutate(nextId)
                  if (nextId) setCurrentSnapshotId.mutate(nextId)
                }}
              >
                {snapshots.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.name}
                  </option>
                ))}
              </select>
            </label>
            <ul className="settings-view-list">
              {snapshots.map((view) => (
                <li key={view.id} className="settings-view-item">
                  <input
                    type="text"
                    value={draftNames[view.id] ?? view.name}
                    onChange={(e) => {
                      const value = e.target.value
                      setDraftNames((prev) => ({ ...prev, [view.id]: value }))
                    }}
                    aria-label={`Rename ${view.name}`}
                  />
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={renameSnapshot.isPending}
                    onClick={() =>
                      renameSnapshot.mutate({
                        id: view.id,
                        name: draftNames[view.id] ?? view.name,
                      })
                    }
                  >
                    Save name
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!canDelete || deleteSnapshot.isPending}
                    onClick={() => {
                      if (!canDelete) return
                      if (!window.confirm('Delete this view?')) return
                      deleteSnapshot.mutate(view.id)
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            {!canDelete && (
              <p className="muted">Create another view before deleting your current one.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

