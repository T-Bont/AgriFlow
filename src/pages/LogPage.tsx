import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFields } from '@/hooks/useFields'
import { useSeasons } from '@/hooks/useSeasons'
import LogForm from '@/components/LogForm'
import './LogPage.css'

export default function LogPage() {
  const { fieldId } = useParams<{ fieldId: string }>()
  const navigate = useNavigate()
  const { fields } = useFields()
  const { seasons } = useSeasons(fieldId)
  const [seasonId, setSeasonId] = useState<string | null>(null)
  const [conditionalLogicEnabled, setConditionalLogicEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const stored = window.localStorage.getItem('conditionalLogicEnabled')
    if (stored === 'true' || stored === 'false') return stored === 'true'
    return import.meta.env.DEV ? false : true
  })
  const field = fields.find((f) => f.id === fieldId)
  const activeSeason = seasons.find((s) => s.status === 'Active') ?? seasons[0]

  const effectiveSeasonId = fieldId ? (seasonId ?? activeSeason?.id ?? null) : null
  const showAllFields = !conditionalLogicEnabled

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('conditionalLogicEnabled', String(conditionalLogicEnabled))
  }, [conditionalLogicEnabled])

  const handleSuccess = () => {
    if (fieldId) navigate(`/field/${fieldId}`)
    else navigate('/')
  }

  if (fieldId && !field) {
    return <div className="log-page-wrap">Loading…</div>
  }
  if (fieldId && (!seasons.length || !effectiveSeasonId)) {
    return (
      <div className="log-page-wrap">
        <p>No active season for this field. Add a season on the field detail first.</p>
        <button type="button" onClick={() => navigate(`/field/${fieldId}`)}>Back</button>
      </div>
    )
  }

  if (!fieldId) {
    return (
      <div className="log-page-wrap">
        <header className="log-page-header">
          <button type="button" className="back-btn" onClick={() => navigate('/')}>← Back</button>
          <h2>Add record</h2>
          <p className="muted">Choose a field and season to log to.</p>
        </header>
        <ul className="field-picker">
          {fields.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => navigate(`/field/${f.id}/log`)}>
                {f.name}
                {f.acres != null ? ` (${f.acres} ac)` : ''}
              </button>
            </li>
          ))}
        </ul>
        {fields.length === 0 && (
          <p className="muted">No fields yet. Add a field on the dashboard first.</p>
        )}
      </div>
    )
  }

  return (
    <div className="log-page-wrap">
      <header className="log-page-header">
        <button type="button" className="back-btn" onClick={() => navigate(`/field/${fieldId}`)}>
          ← Back
        </button>
        <h2>Log record</h2>
        {field && <p className="log-page-field">{field.name}</p>}
        <div className="log-page-controls">
          {seasons.length > 1 && (
            <select
              value={effectiveSeasonId ?? ''}
              onChange={(e) => setSeasonId(e.target.value || null)}
              className="log-page-season"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.year} {s.crop_type}</option>
              ))}
            </select>
          )}
          <label className="log-page-toggle">
            <input
              type="checkbox"
              checked={conditionalLogicEnabled}
              onChange={(e) => setConditionalLogicEnabled(e.target.checked)}
            />
            <span>Conditional logic</span>
          </label>
        </div>
      </header>
      <LogForm
        seasonId={effectiveSeasonId!}
        onSuccess={handleSuccess}
        showAllFields={showAllFields}
        fieldAcres={field ? (field.acres ?? field.gis_acres ?? null) : null}
      />
    </div>
  )
}
