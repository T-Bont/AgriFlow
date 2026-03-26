import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '@/lib/supabase'
import type { FieldPnlRow, Transaction, TransactionCategory } from '@/types/database'
import './FarmPnlChart.css'

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

interface FarmPnlChartProps {
  rows: FieldPnlRow[]
}

export default function FarmPnlChart({ rows }: FarmPnlChartProps) {
  const seasonIds = useMemo(() => rows.map((row) => row.season_id), [rows])
  const revenue = useMemo(() => rows.reduce((sum, row) => sum + row.gross_revenue, 0), [rows])
  const totalExpenses = useMemo(() => rows.reduce((sum, row) => sum + row.total_expenses, 0), [rows])
  const netIncome = useMemo(() => rows.reduce((sum, row) => sum + row.net_income, 0), [rows])

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-by-season', seasonIds],
    queryFn: async () => {
      if (seasonIds.length === 0) return [] as Transaction[]
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .in('season_id', seasonIds)
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
    enabled: seasonIds.length > 0,
  })

  const { chartData, expenseCategoriesUsed } = useMemo(() => {
    const expenseByCategory = transactions
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category] = (acc[tx.category] ?? 0) + Math.abs(tx.amount)
        return acc
      }, {})

    const used = EXPENSE_CATEGORIES.filter((cat) => (expenseByCategory[cat] ?? 0) > 0)
    const expenseRow: Record<string, number | string> = { name: 'Expenses', value: 0 }
    if (used.length > 0) {
      used.forEach((cat) => {
        expenseRow[cat] = expenseByCategory[cat] ?? 0
      })
    } else {
      expenseRow.Other = Math.max(totalExpenses, 0)
    }

    if (revenue === 0 && totalExpenses === 0) {
      return { chartData: [], expenseCategoriesUsed: [] as TransactionCategory[] }
    }

    return {
      chartData: [
        { name: 'Income', value: revenue, ...Object.fromEntries(EXPENSE_CATEGORIES.map((cat) => [cat, 0])) },
        expenseRow,
      ],
      expenseCategoriesUsed: used.length > 0 ? used : (['Other'] as TransactionCategory[]),
    }
  }, [transactions, revenue, totalExpenses])

  if (rows.length === 0 || chartData.length === 0) {
    return (
      <div className="farm-chart-empty">
        <p>No transaction data yet for this season.</p>
      </div>
    )
  }

  return (
    <div className="farm-chart">
      <div className="farm-chart-summary">
        <span>
          Net:{' '}
          <strong className={netIncome >= 0 ? 'positive' : 'negative'}>
            ${netIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </strong>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
          <Tooltip
            shared={false}
            formatter={(value: number, name: string) => [
              `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
              name,
            ]}
          />
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
