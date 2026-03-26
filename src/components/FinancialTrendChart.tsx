import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TransactionCategory } from '@/types/database'
import type { TransactionHistoryItem } from '@/hooks/useTransactionHistory'
import './FinancialTrendChart.css'

type Granularity = 'year' | 'month'

interface FinancialTrendChartProps {
  items: TransactionHistoryItem[]
  isLoading: boolean
}

const PALETTE = ['#2d5a27', '#a0522d', '#4682b4', '#b8860b', '#8b4513', '#6b7280', '#008080', '#7c3aed', '#be123c']
const OVERALL_SERIES = [
  { key: 'overall_income', label: 'Overall income', color: '#2d5a27' },
  { key: 'overall_expense', label: 'Overall expense', color: '#b33' },
  { key: 'overall_net', label: 'Overall net', color: '#1f3a8a' },
] as const

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

export default function FinancialTrendChart({ items, isLoading }: FinancialTrendChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('year')
  const [startYear, setStartYear] = useState<number | null>(null)
  const [endYear, setEndYear] = useState<number | null>(null)

  const categoryOptions = useMemo(
    () => [...new Set(items.map((item) => item.category))].sort() as TransactionCategory[],
    [items],
  )

  const [selectedSeries, setSelectedSeries] = useState<string[]>([
    OVERALL_SERIES[0].key,
    OVERALL_SERIES[1].key,
    OVERALL_SERIES[2].key,
  ])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    for (const item of items) {
      const year = Number(item.date.slice(0, 4))
      if (!Number.isNaN(year) && year > 0) years.add(year)
    }
    return [...years].sort((a, b) => a - b)
  }, [items])

  useEffect(() => {
    if (availableYears.length === 0) {
      setStartYear(null)
      setEndYear(null)
      return
    }
    const minYear = availableYears[0]
    const maxYear = availableYears[availableYears.length - 1]
    setStartYear((prev) => (prev == null || prev < minYear || prev > maxYear ? minYear : prev))
    setEndYear((prev) => (prev == null || prev < minYear || prev > maxYear ? maxYear : prev))
  }, [availableYears])

  useEffect(() => {
    setSelectedSeries((prev) => {
      const valid = new Set([...OVERALL_SERIES.map((s) => s.key), ...categoryOptions.map((c) => `cat:${c}`)])
      const kept = prev.filter((key) => valid.has(key))
      return kept.length > 0 ? kept : [OVERALL_SERIES[0].key, OVERALL_SERIES[1].key, OVERALL_SERIES[2].key]
    })
  }, [categoryOptions])

  const chartData = useMemo(() => {
    if (startYear == null || endYear == null) return []
    const from = Math.min(startYear, endYear)
    const to = Math.max(startYear, endYear)

    const bucketKeys: string[] = []
    if (granularity === 'year') {
      for (let year = from; year <= to; year += 1) bucketKeys.push(String(year))
    } else {
      for (let year = from; year <= to; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          bucketKeys.push(`${year}-${String(month).padStart(2, '0')}`)
        }
      }
    }

    const base = Object.fromEntries(categoryOptions.map((c) => [`cat:${c}`, 0]))
    const bucketMap = new Map(
      bucketKeys.map((key) => [
        key,
        {
          key,
          label: granularity === 'year' ? key : formatMonthLabel(key),
          overall_income: 0,
          overall_expense: 0,
          overall_net: 0,
          ...base,
        } as Record<string, number | string>,
      ]),
    )

    for (const item of items) {
      const date = new Date(item.date)
      if (Number.isNaN(date.getTime())) continue
      const year = date.getFullYear()
      if (year < from || year > to) continue

      const key = granularity === 'year' ? String(year) : `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const row = bucketMap.get(key)
      if (!row) continue

      const amount = Math.abs(item.amount)
      if (item.type === 'INCOME') {
        row.overall_income = Number(row.overall_income) + amount
      } else {
        row.overall_expense = Number(row.overall_expense) + amount
      }
      row.overall_net = Math.abs(Number(row.overall_income) - Number(row.overall_expense))
      const catKey = `cat:${item.category}`
      row[catKey] = Number(row[catKey] ?? 0) + amount
    }

    return bucketKeys.map((key) => bucketMap.get(key)!)
  }, [categoryOptions, endYear, granularity, items, startYear])

  const categorySeries = useMemo(
    () =>
      categoryOptions.map((category, index) => ({
        key: `cat:${category}`,
        label: category,
        color: PALETTE[index % PALETTE.length],
      })),
    [categoryOptions],
  )

  const visibleSeries = useMemo(
    () => [...OVERALL_SERIES, ...categorySeries].filter((series) => selectedSeries.includes(series.key)),
    [categorySeries, selectedSeries],
  )

  const toggleSeries = (key: string) => {
    setSelectedSeries((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))
  }

  const toggleAllCategories = (checked: boolean) => {
    const categoryKeys = categorySeries.map((series) => series.key)
    setSelectedSeries((prev) => {
      const withoutCategories = prev.filter((key) => !key.startsWith('cat:'))
      return checked ? [...withoutCategories, ...categoryKeys] : withoutCategories
    })
  }

  if (isLoading) {
    return <p className="muted">Loading trend data...</p>
  }

  if (items.length === 0 || availableYears.length === 0) {
    return <p className="muted">Add transactions to see historical trends.</p>
  }

  return (
    <div className="financial-trend">
      <div className="financial-trend-controls">
        <label>
          <span>View:</span>
          <select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)}>
            <option value="year">Yearly</option>
            <option value="month">Monthly</option>
          </select>
        </label>
        <label>
          <span>From:</span>
          <select value={startYear ?? availableYears[0]} onChange={(e) => setStartYear(Number(e.target.value))}>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>To:</span>
          <select value={endYear ?? availableYears[availableYears.length - 1]} onChange={(e) => setEndYear(Number(e.target.value))}>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="financial-trend-note">All lines are shown as positive values for easier comparison.</p>

      <div className="financial-trend-filters">
        {OVERALL_SERIES.map((series) => (
          <label key={series.key}>
            <input
              type="checkbox"
              checked={selectedSeries.includes(series.key)}
              onChange={() => toggleSeries(series.key)}
            />
            <span>{series.label}</span>
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={categorySeries.every((series) => selectedSeries.includes(series.key))}
            onChange={(e) => toggleAllCategories(e.target.checked)}
          />
          <span>All categories</span>
        </label>
      </div>

      <div className="financial-trend-categories">
        {categorySeries.map((series) => (
          <label key={series.key}>
            <input
              type="checkbox"
              checked={selectedSeries.includes(series.key)}
              onChange={() => toggleSeries(series.key)}
            />
            <span>{series.label}</span>
          </label>
        ))}
      </div>

      {visibleSeries.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
            <Tooltip
              formatter={(value: number, name: string) => [
                `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                name,
              ]}
            />
            <Legend />
            {visibleSeries.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="muted">Select at least one line to display.</p>
      )}
    </div>
  )
}
