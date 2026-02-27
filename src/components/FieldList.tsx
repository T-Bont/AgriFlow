import type { Field } from '@/types/database'
import type { FieldPnlRow } from '@/types/database'
import './FieldList.css'

interface FieldListProps {
  fields: Field[]
  pnlRows: FieldPnlRow[]
  onSelect: (field: Field) => void
}

export default function FieldList({ fields, pnlRows, onSelect }: FieldListProps) {
  if (fields.length === 0) {
    return (
      <p className="field-list-empty">No fields yet. Add one to get started.</p>
    )
  }
  return (
    <ul className="field-list">
      {fields.map((field) => {
        const latestPnl = pnlRows.filter((r) => r.field_id === field.id).sort((a, b) => b.year - a.year)[0]
        const net = latestPnl?.net_income ?? null
        return (
          <li key={field.id}>
            <button
              type="button"
              className="field-list-item"
              onClick={() => onSelect(field)}
            >
              <span className="field-list-name">{field.name}</span>
              <span className="field-list-meta">
                {field.acres != null ? `${field.acres} ac` : ''}
                {net != null && (
                  <span className={net >= 0 ? 'positive' : 'negative'}>
                    {net >= 0 ? '+' : ''}${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
