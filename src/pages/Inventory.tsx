import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useInventorySummary } from '@/hooks/useInventorySummary'
import './Inventory.css'

export default function Inventory() {
  const { groups, isLoading } = useInventorySummary()
  const groupsByYear = useMemo(() => {
    const map = new Map<number, typeof groups>()
    for (const group of groups) {
      const list = map.get(group.year) ?? []
      list.push(group)
      map.set(group.year, list)
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, yearGroups]) => ({ year, groups: yearGroups }))
  }, [groups])

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
      {groupsByYear.map(({ year, groups: yearGroups }) => (
        <section key={year} className="inventory-year-section" aria-label={`${year} inventory`}>
          <h3 className="inventory-year-header">{year}</h3>
          <div className="inventory-battery-list">
            {yearGroups.map((g) => {
              const total = g.totalHarvested
              const soldContracted = g.totalSold + g.totalContracted
              const soldPct = total > 0 ? (soldContracted / total) * 100 : 0
              const unsoldPct = total > 0 ? (g.unsold / total) * 100 : 0
              return (
                <article key={`${g.cropType}-${g.year}`} className="inventory-battery-card">
                  <h4 className="inventory-battery-title">{g.cropType}</h4>
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
          </div>
        </section>
      ))}
    </div>
  )
}
