import { useState } from 'react'
import type { CropType } from '@/types/database'
import './AddSeasonForm.css'

const CROP_TYPES: CropType[] = ['Corn', 'Soy', 'Wheat', 'Other']

interface AddSeasonFormProps {
  fieldId: string
  onCreate: (payload: { year: number; crop_type: CropType; landlord_share_percent?: number; landlord_name?: string }) => Promise<unknown>
}

export default function AddSeasonForm({ onCreate }: AddSeasonFormProps) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [cropType, setCropType] = useState<CropType>('Corn')
  const [operatorShare, setOperatorShare] = useState('100')
  const [landlordName, setLandlordName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const opShare = parseInt(operatorShare, 10)
      const landlordSharePercent = Number.isNaN(opShare) ? undefined : 100 - Math.max(0, Math.min(100, opShare))
      await onCreate({
        year: parseInt(year, 10),
        crop_type: cropType,
        landlord_share_percent: landlordSharePercent,
        landlord_name: landlordName.trim() || undefined,
      })
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  if (!showForm) {
    return (
      <button type="button" className="btn-outline add-season-btn" onClick={() => setShowForm(true)}>
        + Add season
      </button>
    )
  }
  return (
    <form onSubmit={handleSubmit} className="add-season-form">
      <label>
        <span>Year</span>
        <input
          type="number"
          min="2000"
          max="2100"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          required
        />
      </label>
      <label>
        <span>Crop</span>
        <select value={cropType} onChange={(e) => setCropType(e.target.value as CropType)}>
          {CROP_TYPES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Operator share %</span>
        <input
          type="number"
          min="0"
          max="100"
          value={operatorShare}
          onChange={(e) => setOperatorShare(e.target.value)}
          placeholder="e.g. 100 for owned, 66 for sharecrop"
        />
      </label>
      <label>
        <span>Landlord name (optional)</span>
        <input
          type="text"
          value={landlordName}
          onChange={(e) => setLandlordName(e.target.value)}
          placeholder="e.g. Smith Family"
        />
      </label>
      <div className="add-season-actions">
        <button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
      </div>
    </form>
  )
}
