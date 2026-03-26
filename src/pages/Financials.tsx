import { useEffect, useMemo, useState } from 'react'
import FarmPnlChart from '@/components/FarmPnlChart'
import FinancialTrendChart from '@/components/FinancialTrendChart'
import NetIncomePerAcreList from '@/components/NetIncomePerAcreList'
import { useFieldPnl } from '@/hooks/useFieldPnl'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import './Financials.css'

export default function Financials() {
  const { data: pnlRows = [] } = useFieldPnl()
  const { items: transactionItems, isLoading: transactionsLoading } = useTransactionHistory()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const availableYears = useMemo(
    () => [...new Set(pnlRows.map((row) => row.year))].sort((a, b) => b - a),
    [pnlRows],
  )

  useEffect(() => {
    if (availableYears.length === 0) {
      setSelectedYear(null)
      return
    }
    if (selectedYear == null || !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  const rowsForSeason = useMemo(() => {
    if (selectedYear == null) return []
    return pnlRows.filter((row) => row.year === selectedYear)
  }, [pnlRows, selectedYear])

  return (
    <div className="financials-page">
      <section className="financials-header">
        <h2>Financials</h2>
        {availableYears.length > 0 ? (
          <label className="financials-season-select">
            <span>Season:</span>
            <select
              value={selectedYear ?? availableYears[0]}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Select season year"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted">No seasons available yet.</p>
        )}
      </section>

      <section className="financials-section">
        <h3>Farm P&amp;L</h3>
        <FarmPnlChart rows={rowsForSeason} />
      </section>

      <section className="financials-section">
        <h3>Financial trends</h3>
        <FinancialTrendChart items={transactionItems} isLoading={transactionsLoading} />
      </section>

      <section className="financials-section">
        <h3>Net income per acre</h3>
        <NetIncomePerAcreList rows={rowsForSeason} />
      </section>
    </div>
  )
}
