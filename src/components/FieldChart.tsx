import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useTransactions } from '@/hooks/useTransactions'
import type { FieldPnlRow } from '@/types/database'
import type { TransactionCategory } from '@/types/database'
import './FieldChart.css'

const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'Chemical', 'Fertilizer', 'Seed', 'Fuel', 'Machine Hire', 'Tax', 'Interest', 'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  Chemical: '#8b4513',
  Fertilizer: '#cd853f',
  Seed: '#228b22',
  Fuel: '#b8860b',
  'Machine Hire': '#4682b4',
  Tax: '#696969',
  Interest: '#a0522d',
  Other: '#888',
}

interface FieldChartProps {
  seasonId: string
  pnlRows: FieldPnlRow[]
}

export default function FieldChart({ seasonId, pnlRows }: FieldChartProps) {
  const { transactions } = useTransactions(seasonId)
  const row = pnlRows.find((r) => r.season_id === seasonId)

  const { chartData, expenseCategoriesUsed } = useMemo(() => {
    if (!row) return { chartData: [], expenseCategoriesUsed: [] as TransactionCategory[] }
    const expenseByCategory = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + Math.abs(t.amount)
        return acc
      }, {})
    const income = row.gross_revenue
    const totalExpenses = row.total_expenses
    const expenseRow: Record<string, number | string> = { name: 'Expenses' }
    const used = EXPENSE_CATEGORIES.filter((cat) => (expenseByCategory[cat] ?? 0) > 0)
    used.forEach((cat) => {
      expenseRow[cat] = expenseByCategory[cat] ?? 0
    })
    const hasIncome = income > 0
    const hasExpenses = totalExpenses !== 0
    if (!hasIncome && !hasExpenses) return { chartData: [], expenseCategoriesUsed: [] }
    const data: Record<string, number | string>[] = []
    data.push({ name: 'Income', value: income, ...Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) })
    data.push({ name: 'Expenses', value: 0, ...expenseRow })
    return { chartData: data, expenseCategoriesUsed: used }
  }, [row, transactions])

  if (!row || chartData.length === 0) {
    return (
      <div className="field-chart-empty">
        <p>No transaction data yet. Use the + button to add records.</p>
      </div>
    )
  }

  return (
    <div className="field-chart">
      <div className="field-chart-summary">
        <span>Net: <strong className={row.net_income >= 0 ? 'positive' : 'negative'}>
          ${row.net_income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </strong></span>
        {row.breakeven_price != null && (
          <span>Breakeven: ${row.breakeven_price.toFixed(2)}/bu</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v: number) => [`$${Number(v).toLocaleString()}`, '']} />
          <Legend />
          <Bar dataKey="value" name="Income" fill="#2d5a27" radius={[4, 4, 0, 0]} />
          {expenseCategoriesUsed.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              name={cat}
              stackId="expenses"
              fill={CATEGORY_COLORS[cat]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
