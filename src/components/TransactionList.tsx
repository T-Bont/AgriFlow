import { useTransactions } from '@/hooks/useTransactions'
import type { TransactionCategory } from '@/types/database'
import './TransactionList.css'

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  Harvest: 'Harvest',
  Chemical: 'Chemical',
  Fertilizer: 'Fertilizer',
  Seed: 'Seed',
  'Grain Sale': 'Grain Sale',
  Insurance: 'Insurance',
  'Govt Payment': 'Govt Payment',
  Fuel: 'Fuel',
  'Machine Hire': 'Machine Hire',
  Tax: 'Tax',
  Interest: 'Interest',
  Other: 'Other',
}

interface TransactionListProps {
  seasonId: string
}

export default function TransactionList({ seasonId }: TransactionListProps) {
  const { transactions, isLoading } = useTransactions(seasonId)
  if (isLoading) return <p className="muted">Loading…</p>
  if (transactions.length === 0) {
    return <p className="muted">No transactions. Tap + to add one.</p>
  }
  return (
    <ul className="transaction-list">
      {transactions.map((t) => (
        <li key={t.id} className="transaction-list-item">
          <span className="transaction-date">{t.date}</span>
          <span className="transaction-category">{CATEGORY_LABELS[t.category]}</span>
          {(t.category === 'Harvest' || t.category === 'Grain Sale') && t.quantity != null && t.unit === 'bu' && (
            <span className="transaction-quantity">{t.quantity.toLocaleString()} bu</span>
          )}
          {t.category !== 'Harvest' && (
            <span className={`transaction-amount ${t.type === 'INCOME' ? 'income' : 'expense'}`}>
              {t.type === 'INCOME' ? '+' : '-'}${Math.abs(t.amount).toLocaleString()}
            </span>
          )}
          {t.category === 'Harvest' && t.quantity == null && (
            <span className="transaction-amount income">—</span>
          )}
        </li>
      ))}
    </ul>
  )
}
