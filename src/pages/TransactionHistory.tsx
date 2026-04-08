import { useEffect, useMemo, useState } from 'react'
import type { TransactionCategory } from '@/types/database'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useToast } from '@/stores/toast'
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

type DetailRow = { label: string; value: string }
const N_ANALYSIS_PATTERN = /^\d+(\.\d+)?-\d+(\.\d+)?-\d+(\.\d+)?$/

const EXCLUDED_META_KEYS = new Set([
  'gross_weight',
  'tare_weight',
  'net_weight',
  'moisture_pct',
  'shrink_pct',
  'net_bushels',
  'price_per_bushel',
  'total_deductions',
  'gross_before_deductions',
  'program_type',
  'product_name',
  'application_stage',
  'weather_notes',
  'n_analysis_input',
  'total_lbs',
  'nutrient_analysis',
  'local_tax',
  'state_tax',
  'federal_tax',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function formatMetaKey(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatMetaValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map((entry) => String(entry)).join(', ') : null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function getCategoryRows(category: TransactionCategory, metaData: Record<string, unknown> | null): DetailRow[] {
  if (!metaData) return []
  const rows: DetailRow[] = []
  const pushIfPresent = (label: string, value: unknown) => {
    const formatted = formatMetaValue(value)
    if (formatted) rows.push({ label, value: formatted })
  }

  if (category === 'Harvest') {
    pushIfPresent('Gross Weight (lbs)', metaData.gross_weight)
    pushIfPresent('Tare Weight (lbs)', metaData.tare_weight)
    pushIfPresent('Net Weight (lbs)', metaData.net_weight)
    pushIfPresent('Moisture %', metaData.moisture_pct)
    pushIfPresent('Shrink Factor %', metaData.shrink_pct)
    pushIfPresent('Net Bushels', metaData.net_bushels)
  }

  if (category === 'Grain Sale') {
    pushIfPresent('Price per bushel ($)', metaData.price_per_bushel)
    pushIfPresent('Total deductions ($)', metaData.total_deductions)
    pushIfPresent('Gross before deductions ($)', metaData.gross_before_deductions)
  }

  if (category === 'Govt Payment') {
    pushIfPresent('Program', metaData.program_type)
  }

  if (category === 'Tax') {
    pushIfPresent('Local tax ($)', metaData.local_tax)
    pushIfPresent('State tax ($)', metaData.state_tax)
    pushIfPresent('Federal tax ($)', metaData.federal_tax)
  }

  if (category === 'Fertilizer' || category === 'Chemical') {
    pushIfPresent('Product name', metaData.product_name)
    pushIfPresent('Application stage', metaData.application_stage)
    pushIfPresent('Weather notes', metaData.weather_notes)
    pushIfPresent('N', metaData.n_analysis_input)
    pushIfPresent('Total lbs', metaData.total_lbs)
    const nutrientAnalysis = asRecord(metaData.nutrient_analysis)
    if (nutrientAnalysis) {
      pushIfPresent('Actual N (lbs)', nutrientAnalysis.n_actual)
      pushIfPresent('Actual N per acre (lbs)', nutrientAnalysis.actual_n_per_acre)
    }
  }

  return rows
}

function getFallbackMetaRows(metaData: Record<string, unknown> | null): DetailRow[] {
  if (!metaData) return []
  return Object.entries(metaData)
    .filter(([key]) => !EXCLUDED_META_KEYS.has(key))
    .map(([key, value]) => {
      const formatted = formatMetaValue(value)
      if (!formatted) return null
      return { label: formatMetaKey(key), value: formatted }
    })
    .filter((row): row is DetailRow => row !== null)
}

export default function TransactionHistory() {
  const { items, fields, seasons, isLoading, error, updateTransaction, deleteTransaction } = useTransactionHistory()
  const showToast = useToast((s) => s.show)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftDate, setDraftDate] = useState('')
  const [draftFieldId, setDraftFieldId] = useState('')
  const [draftSeasonId, setDraftSeasonId] = useState('')
  const [draftAmount, setDraftAmount] = useState('')
  const [draftQuantity, setDraftQuantity] = useState('')
  const [draftVendor, setDraftVendor] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [draftProgramType, setDraftProgramType] = useState('')
  const [draftLocalTax, setDraftLocalTax] = useState('')
  const [draftStateTax, setDraftStateTax] = useState('')
  const [draftFederalTax, setDraftFederalTax] = useState('')
  const [draftProductName, setDraftProductName] = useState('')
  const [draftApplicationStage, setDraftApplicationStage] = useState('')
  const [draftWeatherNotes, setDraftWeatherNotes] = useState('')
  const [draftNAnalysis, setDraftNAnalysis] = useState('')
  const [draftTotalLbs, setDraftTotalLbs] = useState('')
  const [draftActualNPerAcre, setDraftActualNPerAcre] = useState('')
  const [draftPricePerBushel, setDraftPricePerBushel] = useState('')
  const [draftTotalDeductions, setDraftTotalDeductions] = useState('')
  const [draftGrossWeight, setDraftGrossWeight] = useState('')
  const [draftTareWeight, setDraftTareWeight] = useState('')
  const [draftNetWeight, setDraftNetWeight] = useState('')
  const [draftMoisturePct, setDraftMoisturePct] = useState('')
  const [draftShrinkPct, setDraftShrinkPct] = useState('')
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
  const seasonsForDraftField = useMemo(
    () => seasons.filter((s) => s.field_id === draftFieldId).sort((a, b) => b.year - a.year),
    [draftFieldId, seasons],
  )

  useEffect(() => {
    if (!editingId) return
    if (seasonsForDraftField.some((season) => season.id === draftSeasonId)) return
    if (seasonsForDraftField.length > 0) {
      setDraftSeasonId(seasonsForDraftField[0].id)
    } else {
      setDraftSeasonId('')
    }
  }, [draftSeasonId, editingId, seasonsForDraftField])

  const startEdit = (item: (typeof items)[number]) => {
    const metaData = asRecord(item.meta_data)
    const nutrientAnalysis = asRecord(metaData?.nutrient_analysis)
    setEditingId(item.id)
    setDraftDate(item.date)
    setDraftFieldId(item.field_id)
    setDraftSeasonId(item.season_id)
    setDraftAmount(String(Math.abs(item.amount)))
    setDraftQuantity(item.quantity != null ? String(item.quantity) : '')
    setDraftVendor(item.vendor ?? '')
    setDraftNotes(item.notes ?? '')
    setDraftProgramType(typeof metaData?.program_type === 'string' ? metaData.program_type : '')
    setDraftLocalTax(metaData?.local_tax != null ? String(metaData.local_tax) : '')
    setDraftStateTax(metaData?.state_tax != null ? String(metaData.state_tax) : '')
    setDraftFederalTax(metaData?.federal_tax != null ? String(metaData.federal_tax) : '')
    setDraftProductName(typeof metaData?.product_name === 'string' ? metaData.product_name : '')
    setDraftApplicationStage(typeof metaData?.application_stage === 'string' ? metaData.application_stage : '')
    setDraftWeatherNotes(typeof metaData?.weather_notes === 'string' ? metaData.weather_notes : '')
    setDraftNAnalysis(typeof metaData?.n_analysis_input === 'string' ? metaData.n_analysis_input : '')
    setDraftTotalLbs(metaData?.total_lbs != null ? String(metaData.total_lbs) : '')
    setDraftActualNPerAcre(nutrientAnalysis?.actual_n_per_acre != null ? String(nutrientAnalysis.actual_n_per_acre) : '')
    setDraftPricePerBushel(metaData?.price_per_bushel != null ? String(metaData.price_per_bushel) : '')
    setDraftTotalDeductions(metaData?.total_deductions != null ? String(metaData.total_deductions) : '')
    setDraftGrossWeight(metaData?.gross_weight != null ? String(metaData.gross_weight) : '')
    setDraftTareWeight(metaData?.tare_weight != null ? String(metaData.tare_weight) : '')
    setDraftNetWeight(metaData?.net_weight != null ? String(metaData.net_weight) : '')
    setDraftMoisturePct(metaData?.moisture_pct != null ? String(metaData.moisture_pct) : '')
    setDraftShrinkPct(metaData?.shrink_pct != null ? String(metaData.shrink_pct) : '')
  }

  const stopEdit = () => {
    setEditingId(null)
    setDraftDate('')
    setDraftFieldId('')
    setDraftSeasonId('')
    setDraftAmount('')
    setDraftQuantity('')
    setDraftVendor('')
    setDraftNotes('')
    setDraftProgramType('')
    setDraftLocalTax('')
    setDraftStateTax('')
    setDraftFederalTax('')
    setDraftProductName('')
    setDraftApplicationStage('')
    setDraftWeatherNotes('')
    setDraftNAnalysis('')
    setDraftTotalLbs('')
    setDraftActualNPerAcre('')
    setDraftPricePerBushel('')
    setDraftTotalDeductions('')
    setDraftGrossWeight('')
    setDraftTareWeight('')
    setDraftNetWeight('')
    setDraftMoisturePct('')
    setDraftShrinkPct('')
  }

  const handleSave = async (item: (typeof items)[number]) => {
    const amountNumber = Number.parseFloat(draftAmount)
    if (item.category !== 'Harvest' && (!Number.isFinite(amountNumber) || amountNumber < 0)) {
      showToast('Enter a valid amount')
      return
    }
    if (!draftFieldId || !fields.some((f) => f.id === draftFieldId)) {
      showToast('Selected field does not exist')
      return
    }
    const chosenSeason = seasons.find((s) => s.id === draftSeasonId)
    if (!chosenSeason || chosenSeason.field_id !== draftFieldId) {
      showToast('Selected season does not exist for the selected field')
      return
    }
    const quantityNumber = draftQuantity.trim() ? Number.parseFloat(draftQuantity) : null
    if ((item.category === 'Harvest' || item.category === 'Grain Sale') && (!Number.isFinite(quantityNumber) || (quantityNumber ?? 0) <= 0)) {
      showToast('Enter a valid quantity greater than zero')
      return
    }
    if (item.category !== 'Harvest' && item.category !== 'Grain Sale' && draftQuantity.trim() && (!Number.isFinite(quantityNumber) || (quantityNumber ?? 0) < 0)) {
      showToast('Enter a valid quantity')
      return
    }
    if ((item.category === 'Fertilizer' || item.category === 'Chemical') && draftNAnalysis.trim() && !N_ANALYSIS_PATTERN.test(draftNAnalysis.trim())) {
      showToast('Enter N in X-X-X format (example: 46-0-0)')
      return
    }
    try {
      const existingMetaData = asRecord(item.meta_data) ?? {}
      const nextMetaData: Record<string, unknown> = { ...existingMetaData }
      const setMetaValue = (key: string, value: unknown) => {
        if (value == null || (typeof value === 'string' && !value.trim())) {
          delete nextMetaData[key]
          return
        }
        nextMetaData[key] = value
      }

      if (item.category === 'Govt Payment') {
        setMetaValue('program_type', draftProgramType.trim())
      }
      if (item.category === 'Tax') {
        setMetaValue('local_tax', parseOptionalNumber(draftLocalTax))
        setMetaValue('state_tax', parseOptionalNumber(draftStateTax))
        setMetaValue('federal_tax', parseOptionalNumber(draftFederalTax))
      }
      if (item.category === 'Fertilizer' || item.category === 'Chemical') {
        setMetaValue('product_name', draftProductName.trim())
        setMetaValue('application_stage', draftApplicationStage.trim())
        setMetaValue('weather_notes', draftWeatherNotes.trim())
        setMetaValue('n_analysis_input', draftNAnalysis.trim())
        setMetaValue('total_lbs', parseOptionalNumber(draftTotalLbs))
        const nPercent = draftNAnalysis.trim() ? Number.parseFloat(draftNAnalysis.split('-')[0] ?? '') : null
        const totalLbs = parseOptionalNumber(draftTotalLbs)
        const actualN = nPercent != null && Number.isFinite(nPercent) && totalLbs != null ? (nPercent / 100) * totalLbs : null
        const actualNPerAcre = parseOptionalNumber(draftActualNPerAcre)
        const nutrientAnalysis = asRecord(nextMetaData.nutrient_analysis) ?? {}
        if (actualN == null && actualNPerAcre == null) {
          delete nextMetaData.nutrient_analysis
        } else {
          if (actualN == null) {
            delete nutrientAnalysis.n_actual
          } else {
            nutrientAnalysis.n_actual = actualN
          }
          if (actualNPerAcre == null) {
            delete nutrientAnalysis.actual_n_per_acre
          } else {
            nutrientAnalysis.actual_n_per_acre = actualNPerAcre
          }
          nextMetaData.nutrient_analysis = nutrientAnalysis
        }
      }
      if (item.category === 'Grain Sale') {
        setMetaValue('price_per_bushel', parseOptionalNumber(draftPricePerBushel))
        setMetaValue('total_deductions', parseOptionalNumber(draftTotalDeductions))
      }
      if (item.category === 'Harvest') {
        setMetaValue('gross_weight', parseOptionalNumber(draftGrossWeight))
        setMetaValue('tare_weight', parseOptionalNumber(draftTareWeight))
        setMetaValue('net_weight', parseOptionalNumber(draftNetWeight))
        setMetaValue('moisture_pct', parseOptionalNumber(draftMoisturePct))
        setMetaValue('shrink_pct', parseOptionalNumber(draftShrinkPct))
        setMetaValue('net_bushels', quantityNumber)
      }

      const signedAmount = item.category === 'Harvest' ? 0 : item.type === 'INCOME' ? Math.abs(amountNumber) : -Math.abs(amountNumber)
      const shouldShowVendor = item.category !== 'Harvest' && item.category !== 'Tax' && item.category !== 'Govt Payment'
      const shouldUseQuantity = item.category === 'Harvest' || item.category === 'Grain Sale'
      await updateTransaction.mutateAsync({
        id: item.id,
        payload: {
          field_id: draftFieldId,
          season_id: draftSeasonId,
          date: draftDate,
          amount: signedAmount,
          quantity: shouldUseQuantity ? quantityNumber : null,
          unit: shouldUseQuantity ? 'bu' : null,
          vendor: shouldShowVendor && draftVendor.trim() ? draftVendor.trim() : null,
          notes: draftNotes.trim() ? draftNotes.trim() : null,
          meta_data: Object.keys(nextMetaData).length ? nextMetaData : null,
        },
      })
      showToast('Transaction updated')
      stopEdit()
    } catch (err) {
      showToast(String(err))
    }
  }

  const handleDelete = async (item: (typeof items)[number]) => {
    const confirmed = window.confirm('Delete this transaction? This cannot be undone.')
    if (!confirmed) return
    try {
      await deleteTransaction.mutateAsync(item.id)
      showToast('Transaction deleted')
      if (selectedId === item.id) setSelectedId(null)
      if (editingId === item.id) stopEdit()
    } catch (err) {
      showToast(String(err))
    }
  }

  const renderDetail = (item: (typeof items)[number]) => (
    (() => {
      const metaData = asRecord(item.meta_data)
      const categoryRows = getCategoryRows(item.category, metaData)
      const fallbackRows = getFallbackMetaRows(metaData)
      return (
    <section className="transaction-history-detail">
      <h3>Details</h3>
      <div className="th-detail-actions">
        <button type="button" className="btn-outline" onClick={() => startEdit(item)}>
          Edit
        </button>
        <button
          type="button"
          className="btn-outline danger"
          onClick={() => void handleDelete(item)}
          disabled={deleteTransaction.isPending}
        >
          Delete
        </button>
      </div>
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
        {[...categoryRows, ...fallbackRows].map((row) => (
          <div className="th-detail-row" key={`${row.label}-${row.value}`}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {editingId === item.id && (
        <form
          className="th-edit-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave(item)
          }}
        >
          <h4>Edit transaction</h4>
          <p className="muted">Category and type are locked. Create a new transaction if those need to change.</p>
          <div className="th-edit-grid">
            <label>
              <span>Category</span>
              <input type="text" value={CATEGORY_LABELS[item.category]} disabled />
            </label>
            <label>
              <span>Type</span>
              <input type="text" value={item.type} disabled />
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} required />
            </label>
            <label>
              <span>Field</span>
              <select value={draftFieldId} onChange={(e) => setDraftFieldId(e.target.value)} required>
                <option value="">Select field</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Season</span>
              <select value={draftSeasonId} onChange={(e) => setDraftSeasonId(e.target.value)} required>
                <option value="">Select season</option>
                {seasonsForDraftField.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.year} {season.crop_type}
                  </option>
                ))}
              </select>
            </label>
            {item.category !== 'Harvest' && (
              <label>
                <span>Amount ($)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  required
                />
              </label>
            )}
            {(item.category === 'Harvest' || item.category === 'Grain Sale') && (
              <>
                <label>
                  <span>{item.category === 'Grain Sale' ? 'Bushels Sold' : 'Net Bushels'}</span>
                  <input type="number" step="0.01" min="0" value={draftQuantity} onChange={(e) => setDraftQuantity(e.target.value)} required />
                </label>
                <label>
                  <span>Unit</span>
                  <input type="text" value="bu" disabled />
                </label>
              </>
            )}
            {item.category !== 'Harvest' && item.category !== 'Tax' && item.category !== 'Govt Payment' && (
              <label>
                <span>Vendor / Payee</span>
                <input type="text" value={draftVendor} onChange={(e) => setDraftVendor(e.target.value)} />
              </label>
            )}
            {item.category === 'Govt Payment' && (
              <label>
                <span>Program</span>
                <input type="text" value={draftProgramType} onChange={(e) => setDraftProgramType(e.target.value)} />
              </label>
            )}
            {item.category === 'Tax' && (
              <>
                <label>
                  <span>Local tax ($)</span>
                  <input type="number" step="0.01" min="0" value={draftLocalTax} onChange={(e) => setDraftLocalTax(e.target.value)} />
                </label>
                <label>
                  <span>State tax ($)</span>
                  <input type="number" step="0.01" min="0" value={draftStateTax} onChange={(e) => setDraftStateTax(e.target.value)} />
                </label>
                <label>
                  <span>Federal tax ($)</span>
                  <input type="number" step="0.01" min="0" value={draftFederalTax} onChange={(e) => setDraftFederalTax(e.target.value)} />
                </label>
              </>
            )}
            {(item.category === 'Fertilizer' || item.category === 'Chemical') && (
              <>
                <label>
                  <span>Product Name</span>
                  <input type="text" value={draftProductName} onChange={(e) => setDraftProductName(e.target.value)} />
                </label>
                <label>
                  <span>Application Stage</span>
                  <input type="text" value={draftApplicationStage} onChange={(e) => setDraftApplicationStage(e.target.value)} />
                </label>
                <label>
                  <span>Weather Notes</span>
                  <input type="text" value={draftWeatherNotes} onChange={(e) => setDraftWeatherNotes(e.target.value)} />
                </label>
                <label>
                  <span>N (X-X-X)</span>
                  <input type="text" value={draftNAnalysis} onChange={(e) => setDraftNAnalysis(e.target.value)} placeholder="46-0-0" />
                </label>
                <label>
                  <span>Total lbs</span>
                  <input type="number" step="0.1" min="0" value={draftTotalLbs} onChange={(e) => setDraftTotalLbs(e.target.value)} />
                </label>
                <label>
                  <span>Actual N per acre (lbs)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draftActualNPerAcre}
                    onChange={(e) => setDraftActualNPerAcre(e.target.value)}
                  />
                </label>
              </>
            )}
            {item.category === 'Grain Sale' && (
              <>
                <label>
                  <span>Price per bushel ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draftPricePerBushel}
                    onChange={(e) => setDraftPricePerBushel(e.target.value)}
                  />
                </label>
                <label>
                  <span>Total deductions ($)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draftTotalDeductions}
                    onChange={(e) => setDraftTotalDeductions(e.target.value)}
                  />
                </label>
              </>
            )}
            {item.category === 'Harvest' && (
              <>
                <label>
                  <span>Gross Weight (lbs)</span>
                  <input type="number" step="0.1" min="0" value={draftGrossWeight} onChange={(e) => setDraftGrossWeight(e.target.value)} />
                </label>
                <label>
                  <span>Tare Weight (lbs)</span>
                  <input type="number" step="0.1" min="0" value={draftTareWeight} onChange={(e) => setDraftTareWeight(e.target.value)} />
                </label>
                <label>
                  <span>Net Weight (lbs)</span>
                  <input type="number" step="0.1" min="0" value={draftNetWeight} onChange={(e) => setDraftNetWeight(e.target.value)} />
                </label>
                <label>
                  <span>Moisture %</span>
                  <input type="number" step="0.1" min="0" max="100" value={draftMoisturePct} onChange={(e) => setDraftMoisturePct(e.target.value)} />
                </label>
                <label>
                  <span>Shrink Factor %</span>
                  <input type="number" step="0.1" min="0" value={draftShrinkPct} onChange={(e) => setDraftShrinkPct(e.target.value)} />
                </label>
              </>
            )}
          </div>
          <label>
            <span>Notes</span>
            <textarea rows={2} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} />
          </label>
          <div className="th-edit-actions">
            <button type="submit" disabled={updateTransaction.isPending}>
              {updateTransaction.isPending ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" className="btn-outline" onClick={stopEdit}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
      )
    })()
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

