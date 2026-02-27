import { Link } from 'react-router-dom'
import { useInventorySummary } from '@/hooks/useInventorySummary'
import './Inventory.css'

export default function Inventory() {
  const { groups, isLoading } = useInventorySummary()

  if (isLoading) {
    return (
      <div className="inventory-page">
        <p className="muted">Loading inventory…</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="inventory-page">
        <h2>Inventory</h2>
        <p className="muted">No seasons yet. Add fields and seasons on Home to see harvest and sales here.</p>
      </div>
    )
  }

  return (
    <div className="inventory-page">
      <h2>Inventory</h2>
      <p className="inventory-intro">
        Total harvested vs sold/contracted by crop and year. Unsold grain is market risk.
      </p>
      <section className="inventory-battery-list" aria-label="Cross-season inventory">
        {groups.map((g) => {
          const total = g.totalHarvested > 0 ? g.totalHarvested : 1000
          const soldContracted = g.totalSold + g.totalContracted
          const soldPct = total > 0 ? (soldContracted / total) * 100 : 0
          const unsoldPct = total > 0 ? (g.unsold / total) * 100 : 0
          return (
            <article key={`${g.cropType}-${g.year}`} className="inventory-battery-card">
              <h3 className="inventory-battery-title">{g.label}</h3>
              <div
                className="inventory-battery-bar"
                role="img"
                aria-label={`${g.label}: ${total.toLocaleString()} bushels total, ${soldContracted.toLocaleString()} sold or contracted, ${g.unsold.toLocaleString()} unsold`}
              >
                <span
                  className="inventory-battery-segment sold"
                  style={{ width: `${soldPct}%` }}
                />
                <span
                  className="inventory-battery-segment unsold"
                  style={{ width: `${unsoldPct}%` }}
                />
              </div>
              <div className="inventory-battery-stats">
                <span className="inventory-stat">
                  Total: <strong>{total.toLocaleString()} bu</strong>
                  {g.totalHarvested === 0 && <em> (default)</em>}
                </span>
                <span className="inventory-stat sold">
                  Sold/Contracted: <strong>{soldContracted.toLocaleString()} bu</strong>
                  {total > 0 && ` (${soldPct.toFixed(0)}%)`}
                </span>
                <span className="inventory-stat unsold">
                  Unsold: <strong>{g.unsold.toLocaleString()} bu</strong>
                  {total > 0 && ` (${unsoldPct.toFixed(0)}%)`}
                </span>
              </div>
              {g.unsold > 0 && (
                <div className="inventory-battery-actions">
                  <Link to="/log" className="btn-outline inventory-add-sale">
                    Log sale
                  </Link>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </div>
  )
}
