import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFields } from '@/hooks/useFields'
import { useSeasons } from '@/hooks/useSeasons'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import FieldChart from '@/components/FieldChart'
import TransactionList from '@/components/TransactionList'
import AddSeasonForm from '@/components/AddSeasonForm'
import FieldInventoryBar from '@/components/FieldInventoryBar'
import './FieldDetail.css'

export default function FieldDetail() {
  const { fieldId } = useParams<{ fieldId: string }>()
  const navigate = useNavigate()
  const { fields, deleteField } = useFields()
  const { seasons, createSeason } = useSeasons(fieldId)
  const { data: pnlRows = [] } = useFieldPnl()
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null)
  const field = fields.find((f) => f.id === fieldId)
  const fieldPnl = pnlRows.filter((r) => r.field_id === fieldId)
  const activeSeason =
    seasons.find((s) => s.id === selectedSeasonId) ??
    seasons.find((s) => s.status === 'Active') ??
    seasons[0]

  const handleDeleteField = () => {
    if (!fieldId || !window.confirm(`Delete "${field?.name}"? This cannot be undone.`)) return
    deleteField.mutate(fieldId, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: (err) => alert(err instanceof Error ? err.message : 'Failed to delete field'),
    })
  }

  if (!fieldId) {
    navigate('/')
    return null
  }
  if (!field) {
    return <div className="field-detail-loading">Loading field…</div>
  }

  return (
    <div className="field-detail">
      <header className="field-detail-header">
        <div className="field-detail-header-row">
          <button type="button" className="back-btn" onClick={() => navigate('/')}>
            ← Back
          </button>
          <button
            type="button"
            className="field-delete-btn"
            onClick={handleDeleteField}
            disabled={deleteField.isPending}
            aria-label="Delete field"
          >
            {deleteField.isPending ? 'Deleting…' : 'Delete field'}
          </button>
        </div>
        <h1>{field.name}</h1>
        {field.acres != null && <p className="field-acres">{field.acres} acres</p>}
      </header>
      <section className="field-detail-section">
        <h2>Seasons</h2>
        {seasons.length === 0 ? (
          <AddSeasonForm fieldId={fieldId} onCreate={(p) => createSeason.mutateAsync(p)} />
        ) : (
          <>
            <ul className="season-tabs">
              {seasons.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={s.id === activeSeason?.id ? 'active' : ''}
                    onClick={() => setSelectedSeasonId(s.id)}
                  >
                    {s.year} {s.crop_type}
                  </button>
                </li>
              ))}
            </ul>
            <AddSeasonForm fieldId={fieldId} onCreate={(p) => createSeason.mutateAsync(p)} />
          </>
        )}
      </section>
      {activeSeason && (
        <>
          <section className="field-detail-section">
            <h2>Inventory</h2>
            <FieldInventoryBar seasonId={activeSeason.id} />
          </section>
          <section className="field-detail-section">
            <h2>P&L</h2>
            <FieldChart seasonId={activeSeason.id} pnlRows={fieldPnl} />
          </section>
          <section className="field-detail-section">
            <h2>Transactions</h2>
            <TransactionList seasonId={activeSeason.id} />
          </section>
        </>
      )}
    </div>
  )
}
