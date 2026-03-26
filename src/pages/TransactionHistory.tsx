import { useEffect, useState } from 'react'
import type { TransactionCategory } from '@/types/database'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import './TransactionHistory.css'

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

export default function TransactionHistory() {
  const { items, isLoading, error } = useTransactionHistory()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const onChange = () => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  if (isLoading) {
    return <p className="muted">Loading transactions…</p>
  }
  if (error) {
    return <p className="muted">Failed to load transactions.</p>
  }
  if (!items.length) {
    return <p className="muted">No transactions yet.</p>
  }

  const selected = items.find((t) => t.id === selectedId) ?? null

  const renderDetail = (item: (typeof items)[number]) => (
    <section className="transaction-history-detail">
      <h3>Details</h3>
      <dl>
        <div className="th-detail-row">
          <dt>Date</dt>
          <dd>{item.date}</dd>
        </div>
        <div className="th-detail-row">
          <dt>Field</dt>
          <dd>{item.field_name}</dd>
        </div>
        <div className="th-detail-row">
          <dt>Season</dt>
          <dd>
            {item.season.year
              ? `${item.season.year} ${item.season.crop_type}`
              : item.season.crop_type}
          </dd>
        </div>
        <div className="th-detail-row">
          <dt>Category</dt>
          <dd>{CATEGORY_LABELS[item.category]}</dd>
        </div>
        <div className="th-detail-row">
          <dt>Type</dt>
          <dd>{item.type}</dd>
        </div>
        {item.category !== 'Harvest' && (
          <div className="th-detail-row">
            <dt>Amount</dt>
            <dd>
              {item.type === 'INCOME' ? '+' : '-'}$
              {Math.abs(item.amount).toLocaleString()}
            </dd>
          </div>
        )}
        {item.quantity != null && (
          <div className="th-detail-row">
            <dt>Quantity</dt>
            <dd>
              {item.quantity.toLocaleString()}
              {item.unit ? ` ${item.unit}` : ''}
            </dd>
          </div>
        )}
        {item.vendor && (
          <div className="th-detail-row">
            <dt>Vendor / Payee</dt>
            <dd>{item.vendor}</dd>
          </div>
        )}
        {item.notes && (
          <div className="th-detail-row">
            <dt>Notes</dt>
            <dd>{item.notes}</dd>
          </div>
        )}
      </dl>
    </section>
  )

  return (
    <div className="transaction-history-page">
      <h2>Transaction history</h2>
      <div className="transaction-history-layout">
        <ul className="transaction-history-list">
          {items.map((t) => {
            const isSelected = t.id === selectedId
            let amountLabel = ''
            let amountClass = ''
            if (t.category === 'Harvest') {
              amountLabel = 'Harvest log'
              amountClass = 'harvest'
            } else if (t.type === 'INCOME') {
              amountLabel = `+$${Math.abs(t.amount).toLocaleString()}`
              amountClass = 'income'
            } else {
              amountLabel = `-$${Math.abs(t.amount).toLocaleString()}`
              amountClass = 'expense'
            }

            return (
              <li key={t.id} className={`th-item${isSelected ? ' selected' : ''}`}>
                <button type="button" onClick={() => setSelectedId(t.id)}>
                  <span className="th-date">{t.date}</span>
                  <span className="th-main">
                    <span className="th-category">{CATEGORY_LABELS[t.category]}</span>
                    <span className="th-field">{t.field_name}</span>
                  </span>
                  <span className={`th-amount ${amountClass}`}>{amountLabel}</span>
                </button>
                {isMobile && isSelected && <div className="th-inline-detail">{renderDetail(t)}</div>}
              </li>
            )
          })}
        </ul>
        {!isMobile && selected && renderDetail(selected)}
      </div>
    </div>
  )
}

