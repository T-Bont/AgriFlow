import { useMemo } from 'react'
import type { FieldPnlRow } from '@/types/database'
import './NetIncomePerAcreList.css'

interface NetIncomePerAcreListProps {
  rows: FieldPnlRow[]
}

export default function NetIncomePerAcreList({ rows }: NetIncomePerAcreListProps) {
  const sortedRows = useMemo(() => {
    const withPerAcre = rows.filter((row) => row.net_income_per_acre != null)
    if (withPerAcre.length > 0) {
      return [...withPerAcre].sort((a, b) => (b.net_income_per_acre ?? 0) - (a.net_income_per_acre ?? 0))
    }
    return [...rows].sort((a, b) => b.net_income - a.net_income)
  }, [rows])

  if (rows.length === 0) {
    return <p className="muted">No fields found for this season.</p>
  }

  return (
    <>
      <ul className="leaderboard">
        {sortedRows.map((row) => (
          <li key={row.season_id}>
            <span className="leaderboard-name">{row.field_name}</span>
            <span className={(row.net_income_per_acre ?? row.net_income) >= 0 ? 'positive' : 'negative'}>
              {row.net_income_per_acre != null
                ? `$${row.net_income_per_acre.toLocaleString(undefined, { maximumFractionDigits: 0 })}/ac`
                : `$${row.net_income.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </span>
          </li>
        ))}
      </ul>
      {rows.every((row) => row.net_income_per_acre == null) && (
        <p className="muted">Add acres to fields to see net income per acre.</p>
      )}
    </>
  )
}
