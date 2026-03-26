import { useMemo } from 'react'
import { useTransactions } from '@/hooks/useTransactions'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import './FieldInventoryBar.css'

interface FieldInventoryBarProps {
  seasonId: string
}

export default function FieldInventoryBar({ seasonId }: FieldInventoryBarProps) {
  const { transactions, isLoading } = useTransactions(seasonId)
  const { data: pnlRows = [] } = useFieldPnl()
  const row = pnlRows.find((r) => r.season_id === seasonId)

  const { total, sold, unsold } = useMemo(() => {
    const harvestedFromView = row?.total_harvested_bushels ?? 0
    const harvestedFromTx = transactions
      .filter((t) => t.category === 'Harvest' && t.unit === 'bu' && t.quantity != null)
      .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
    const harvested = harvestedFromView || harvestedFromTx
    const totalHarvested = harvested
    const soldBu = transactions
      .filter((t) => t.category === 'Grain Sale' && t.unit === 'bu' && t.quantity != null)
      .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
    const unsoldBu = Math.max(0, totalHarvested - soldBu)
    return { total: totalHarvested, sold: soldBu, unsold: unsoldBu }
  }, [row, transactions])

  if (isLoading) {
    return (
      <div className="field-inventory">
        <p className="muted">Loading inventory…</p>
      </div>
    )
  }

  if (total <= 0) {
    return (
      <div className="field-inventory">
        <p className="muted">No harvest or sales logged yet.</p>
      </div>
    )
  }

  const soldPct = total > 0 ? (sold / total) * 100 : 0
  const unsoldPct = total > 0 ? (unsold / total) * 100 : 0
  const userSharePct = Math.max(0, Math.min(100, 100 - (row?.landlord_share_percent ?? 0)))
  const buPerAcre = row?.field_acres != null && row.field_acres > 0 ? total / row.field_acres : null

  return (
    <div className="field-inventory">
      <div
        className="field-inventory-bar"
        role="img"
        aria-label={`${total.toLocaleString()} bushels total, ${sold.toLocaleString()} sold, ${unsold.toLocaleString()} unsold`}
      >
        <span
          className="field-inventory-segment sold"
          style={{ width: `${soldPct}%` }}
        />
        <span
          className="field-inventory-segment unsold"
          style={{ width: `${unsoldPct}%` }}
        />
      </div>
      <div className="field-inventory-stats">
        <span className="field-inventory-stat">
          Total: <strong>{total.toLocaleString()} bu</strong>
        </span>
        <span className="field-inventory-stat">
          bu/acre:{' '}
          <strong>
            {buPerAcre != null
              ? buPerAcre.toLocaleString(undefined, { maximumFractionDigits: 1 })
              : '—'}
          </strong>
        </span>
        <span className="field-inventory-stat sold">
          Sold: <strong>{sold.toLocaleString()} bu</strong>
          {total > 0 && ` (${soldPct.toFixed(0)}%)`}
        </span>
        <span className="field-inventory-stat unsold">
          Unsold: <strong>{unsold.toLocaleString()} bu</strong>
          {total > 0 && ` (${unsoldPct.toFixed(0)}%)`}
        </span>
        <span className="field-inventory-stat share">
          Share: <strong>{userSharePct.toFixed(0)}%</strong>
        </span>
      </div>
    </div>
  )
}

