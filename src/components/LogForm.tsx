import { useState } from 'react'
import type { TransactionCategory, TransactionType } from '@/types/database'
import { useTransactions } from '@/hooks/useTransactions'
import { useProfile } from '@/hooks/useProfile'
import { usePicklists } from '@/hooks/usePicklists'
import { mergeAndSavePicklists } from '@/lib/picklists'
import { useToast } from '@/stores/toast'
import './LogForm.css'

const DEFAULT_PREHARVEST_BU = 1000

const CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'Harvest', label: 'Harvest' },
  { value: 'Grain Sale', label: 'Grain Sale' },
  { value: 'Govt Payment', label: 'Govt Payment' },
  { value: 'Insurance', label: 'Insurance' },
  { value: 'Chemical', label: 'Chemical' },
  { value: 'Fertilizer', label: 'Fertilizer' },
  { value: 'Seed', label: 'Seed' },
  { value: 'Fuel', label: 'Fuel' },
  { value: 'Machine Hire', label: 'Machine Hire' },
  { value: 'Tax', label: 'Tax' },
  { value: 'Interest', label: 'Interest' },
  { value: 'Other', label: 'Other' },
]

const INCOME_CATEGORIES: TransactionCategory[] = ['Harvest', 'Grain Sale', 'Govt Payment', 'Insurance']
const EXPENSE_CATEGORIES: TransactionCategory[] = ['Chemical', 'Fertilizer', 'Seed', 'Fuel', 'Machine Hire', 'Tax', 'Interest', 'Other']

const DEFAULT_APPLICATION_STAGES = ['Pre-Plant', 'Starter', 'Top Dress', 'Spring Weed', 'Fall Weed', 'Desiccant']
const DEFAULT_GOV_PROGRAMS = ['PLC', 'ARC', 'CFAP', 'ERP', 'MFP', 'Other']

interface LogFormProps {
  seasonId: string
  onSuccess: () => void
  showAllFields?: boolean
  /** Field acres for N per acre calculation (optional) */
  fieldAcres?: number | null
}

export default function LogForm({ seasonId, onSuccess, showAllFields = false, fieldAcres }: LogFormProps) {
  const { addTransaction, transactions } = useTransactions(seasonId)
  const { profile, updateProfile } = useProfile()
  const { vendors, productNames, applicationStages } = usePicklists(transactions)
  const showToast = useToast((s) => s.show)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState<TransactionCategory>('Fuel')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')
  const [productName, setProductName] = useState('')
  const [applicationStage, setApplicationStage] = useState('')
  const [weatherNotes, setWeatherNotes] = useState('')
  const [nPerc, setNPerc] = useState('')
  const [totalLbs, setTotalLbs] = useState('')
  const [grossWeight, setGrossWeight] = useState('')
  const [tareWeight, setTareWeight] = useState('')
  const [netWeight, setNetWeight] = useState('')
  const [moisturePct, setMoisturePct] = useState('')
  const [shrinkPct, setShrinkPct] = useState('')
  const [netBushels, setNetBushels] = useState('')
  const [bushelsSold, setBushelsSold] = useState('')
  const [pricePerBushel, setPricePerBushel] = useState('')
  const [totalDeductions, setTotalDeductions] = useState('')
  const [netIncome, setNetIncome] = useState('')
  const [programType, setProgramType] = useState('')
  const [newGovProgram, setNewGovProgram] = useState('')
  const [newVendor, setNewVendor] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [newApplicationStage, setNewApplicationStage] = useState('')

  const isIncome = INCOME_CATEGORIES.includes(category)
  const type: TransactionType = isIncome ? 'INCOME' : 'EXPENSE'
  const isHarvest = category === 'Harvest'
  const showVendorAndNotes = showAllFields || (!isIncome && !isHarvest)
  const showFertilizer = showAllFields || category === 'Fertilizer' || category === 'Chemical'
  const showGrainSale = showAllFields || category === 'Grain Sale'
  const showHarvest = showAllFields || isHarvest
  const showGovPayment = showAllFields || category === 'Govt Payment'

  const computedNetIncome =
    bushelsSold && pricePerBushel
      ? parseFloat(bushelsSold) * parseFloat(pricePerBushel) - (parseFloat(totalDeductions) || 0)
      : null
  const effectiveNetIncome = netIncome !== '' ? parseFloat(netIncome) : computedNetIncome

  const govPrograms = [...DEFAULT_GOV_PROGRAMS, ...(profile?.settings?.gov_programs ?? [])]

  const safeApplicationStages = Array.isArray(applicationStages) ? applicationStages : []
  const allApplicationStages = [...new Set([...DEFAULT_APPLICATION_STAGES, ...safeApplicationStages])]

  const handleAddGovProgram = async () => {
    const name = newGovProgram.trim()
    if (!name) return
    const current = profile?.settings?.gov_programs ?? []
    if (current.includes(name)) {
      setNewGovProgram('')
      return
    }
    try {
      await updateProfile.mutateAsync({
        settings: { ...profile?.settings, gov_programs: [...current, name] },
      })
      setNewGovProgram('')
      setProgramType(name)
      showToast('Program added')
    } catch (err) {
      showToast(String(err))
    }
  }

  const handleAddVendor = async () => {
    const name = newVendor.trim()
    if (!name) return
    const existing = new Set(vendors)
    if (existing.has(name)) {
      setNewVendor('')
      setVendor(name)
      return
    }
    try {
      await mergeAndSavePicklists([name], [], [])
      setNewVendor('')
      setVendor(name)
      showToast('Vendor added')
    } catch (err) {
      showToast(String(err))
    }
  }

  const handleAddProductName = async () => {
    const name = newProductName.trim()
    if (!name) return
    const existing = new Set(productNames)
    if (existing.has(name)) {
      setNewProductName('')
      setProductName(name)
      return
    }
    try {
      await mergeAndSavePicklists([], [name], [])
      setNewProductName('')
      setProductName(name)
      showToast('Product added')
    } catch (err) {
      showToast(String(err))
    }
  }

  const handleAddApplicationStage = async () => {
    const name = newApplicationStage.trim()
    if (!name) return
    const existing = new Set(allApplicationStages)
    if (existing.has(name)) {
      setNewApplicationStage('')
      setApplicationStage(name)
      return
    }
    try {
      await mergeAndSavePicklists([], [], [name])
      setNewApplicationStage('')
      setApplicationStage(name)
      showToast('Application stage added')
    } catch (err) {
      showToast(String(err))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const meta: Record<string, unknown> = {}
    let submitAmount: number
    let quantity: number | undefined
    let unit: 'bu' | undefined

    if (isHarvest) {
      const netBu = parseFloat(netBushels)
      if (Number.isNaN(netBu)) return
      submitAmount = 0
      quantity = netBu
      unit = 'bu'
      meta.gross_weight = grossWeight ? parseFloat(grossWeight) : undefined
      meta.tare_weight = tareWeight ? parseFloat(tareWeight) : undefined
      meta.net_weight = netWeight ? parseFloat(netWeight) : undefined
      meta.moisture_pct = moisturePct ? parseFloat(moisturePct) : undefined
      meta.shrink_pct = shrinkPct ? parseFloat(shrinkPct) : undefined
      meta.net_bushels = netBu
    } else if (showGrainSale) {
      const sold = parseFloat(bushelsSold)
      if (Number.isNaN(sold)) return
      if (effectiveNetIncome == null || Number.isNaN(effectiveNetIncome)) return
      const harvestedBu = transactions
        .filter((t) => t.category === 'Harvest' && t.unit === 'bu' && t.quantity != null)
        .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
      const alreadySoldBu = transactions
        .filter((t) => t.category === 'Grain Sale' && t.unit === 'bu' && t.quantity != null)
        .reduce((sum, t) => sum + (t.quantity ?? 0), 0)
      const totalAvailable = harvestedBu > 0 ? harvestedBu : DEFAULT_PREHARVEST_BU
      const remaining = totalAvailable - alreadySoldBu
      if (sold > remaining) {
        showToast(
          `Cannot sell ${sold.toLocaleString()} bu. You have only ${Math.max(
            0,
            remaining,
          ).toLocaleString()} bu available for this season.`,
        )
        return
      }
      submitAmount = effectiveNetIncome
      quantity = sold
      unit = 'bu'
      meta.price_per_bushel = parseFloat(pricePerBushel)
      meta.total_deductions = totalDeductions ? parseFloat(totalDeductions) : 0
      meta.gross_before_deductions = parseFloat(bushelsSold) * parseFloat(pricePerBushel)
    } else {
      const numAmount = parseFloat(amount)
      if (Number.isNaN(numAmount)) return
      submitAmount = isIncome ? Math.abs(numAmount) : -Math.abs(numAmount)
    }

    if (showGovPayment && programType) meta.program_type = programType
    if (showFertilizer) {
      if (productName) meta.product_name = productName
      if (applicationStage) meta.application_stage = applicationStage
      if (weatherNotes) meta.weather_notes = weatherNotes
      if (nPerc && totalLbs) {
        const totalN = (parseFloat(nPerc) / 100) * parseFloat(totalLbs)
        const acres = fieldAcres ?? undefined
        meta.nutrient_analysis = {
          n_actual: totalN,
          actual_n_per_acre: acres != null && acres > 0 ? totalN / acres : undefined,
          p: 0,
          k: 0,
        }
      }
    }

    try {
      await addTransaction.mutateAsync({
        date,
        type,
        category,
        amount: submitAmount,
        vendor: vendor || undefined,
        notes: notes || undefined,
        quantity,
        unit,
        meta_data: Object.keys(meta).length ? meta : undefined,
      })
      showToast(navigator.onLine ? 'Synced to cloud' : 'Saved to device')
      onSuccess()
    } catch (err) {
      showToast(String(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="log-form">
      <label>
        <span>Date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        <span>Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TransactionCategory)}
          required
        >
          <optgroup label="Income">
            {CATEGORIES.filter((c) => INCOME_CATEGORIES.includes(c.value)).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </optgroup>
          <optgroup label="Expense">
            {CATEGORIES.filter((c) => EXPENSE_CATEGORIES.includes(c.value)).map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </optgroup>
        </select>
      </label>
      {!showHarvest && (
        <label>
          <span>Amount ($)</span>
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      )}
      {showVendorAndNotes && (
        <label>
          <span>Vendor / Payee</span>
          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          >
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <div className="log-form-row">
            <input
              type="text"
              value={newVendor}
              onChange={(e) => setNewVendor(e.target.value)}
              placeholder="Add new vendor"
            />
            <button
              type="button"
              onClick={handleAddVendor}
              disabled={!newVendor.trim()}
            >
              Add
            </button>
          </div>
        </label>
      )}
      {showFertilizer && (
        <>
          <label>
            <span>Product name</span>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            >
              <option value="">—</option>
              {productNames.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="log-form-row">
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Add new product"
              />
              <button
                type="button"
                onClick={handleAddProductName}
                disabled={!newProductName.trim()}
              >
                Add
              </button>
            </div>
          </label>
          <label>
            <span>Application stage</span>
            <select value={applicationStage} onChange={(e) => setApplicationStage(e.target.value)}>
              <option value="">—</option>
              {allApplicationStages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="log-form-row">
              <input
                type="text"
                value={newApplicationStage}
                onChange={(e) => setNewApplicationStage(e.target.value)}
                placeholder="Add new stage"
              />
              <button
                type="button"
                onClick={handleAddApplicationStage}
                disabled={!newApplicationStage.trim()}
              >
                Add
              </button>
            </div>
          </label>
          <label>
            <span>Weather notes</span>
            <input
              type="text"
              value={weatherNotes}
              onChange={(e) => setWeatherNotes(e.target.value)}
              placeholder="e.g. Applied 12hrs before rain"
            />
          </label>
          <div className="log-form-row">
            <label>
              <span>N % (e.g. 46)</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={nPerc}
                onChange={(e) => setNPerc(e.target.value)}
              />
            </label>
            <label>
              <span>Total lbs</span>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={totalLbs}
                onChange={(e) => setTotalLbs(e.target.value)}
              />
            </label>
          </div>
          {fieldAcres != null && fieldAcres > 0 && (
            <p className="log-form-hint">Actual N per acre will be calculated from total lbs and field acres.</p>
          )}
        </>
      )}
      {showHarvest && (
        <>
          <label>
            <span>Gross Weight (lbs)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={grossWeight}
              onChange={(e) => setGrossWeight(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Tare Weight (lbs)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={tareWeight}
              onChange={(e) => setTareWeight(e.target.value)}
            />
          </label>
          <label>
            <span>Net Weight (lbs)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={netWeight}
              onChange={(e) => setNetWeight(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Moisture %</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              inputMode="decimal"
              value={moisturePct}
              onChange={(e) => setMoisturePct(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Shrink Factor %</span>
            <input
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              value={shrinkPct}
              onChange={(e) => setShrinkPct(e.target.value)}
            />
          </label>
          <label>
            <span>Net Bushels</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={netBushels}
              onChange={(e) => setNetBushels(e.target.value)}
              required
            />
          </label>
        </>
      )}
      {showGrainSale && (
        <>
          <label>
            <span>Bushels Sold</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={bushelsSold}
              onChange={(e) => {
                setBushelsSold(e.target.value)
                if (netIncome === '' && pricePerBushel) {
                  const d = parseFloat(totalDeductions) || 0
                  setNetIncome(String((parseFloat(e.target.value) || 0) * parseFloat(pricePerBushel) - d))
                }
              }}
              required
            />
          </label>
          <label>
            <span>Price per bushel ($)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={pricePerBushel}
              onChange={(e) => {
                setPricePerBushel(e.target.value)
                if (netIncome === '' && bushelsSold) {
                  const d = parseFloat(totalDeductions) || 0
                  setNetIncome(String((parseFloat(bushelsSold) || 0) * (parseFloat(e.target.value) || 0) - d))
                }
              }}
              required
            />
          </label>
          <label>
            <span>Total deductions ($)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={totalDeductions}
              onChange={(e) => {
                setTotalDeductions(e.target.value)
                if (netIncome === '' && bushelsSold && pricePerBushel) {
                  setNetIncome(
                    String(
                      parseFloat(bushelsSold) * parseFloat(pricePerBushel) - (parseFloat(e.target.value) || 0),
                    ),
                  )
                }
              }}
            />
          </label>
          <label>
            <span>Net Income ($)</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={netIncome !== '' ? netIncome : (computedNetIncome ?? '')}
              onChange={(e) => setNetIncome(e.target.value)}
              required
            />
          </label>
        </>
      )}
      {showGovPayment && (
        <>
          <label>
            <span>Program</span>
            <select value={programType} onChange={(e) => setProgramType(e.target.value)}>
              <option value="">—</option>
              {govPrograms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <div className="log-form-row">
            <input
              type="text"
              value={newGovProgram}
              onChange={(e) => setNewGovProgram(e.target.value)}
              placeholder="Add new program name"
            />
            <button type="button" onClick={handleAddGovProgram} disabled={!newGovProgram.trim() || updateProfile.isPending}>
              Add program
            </button>
          </div>
        </>
      )}
      {showVendorAndNotes && (
        <label>
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>
      )}
      <div className="log-form-actions">
        <button type="submit" disabled={addTransaction.isPending}>
          {addTransaction.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
