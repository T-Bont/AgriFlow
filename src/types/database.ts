export type CropType = 'Corn' | 'Soy' | 'Wheat' | 'Other'
export type SeasonStatus = 'Active' | 'Archived'
export type ContractType = 'Cash' | 'Basis' | 'Futures_Hedge'
export type ContractStatus = 'Open' | 'Fulfilled' | 'Cancelled'
export type TransactionType = 'INCOME' | 'EXPENSE'
export type TransactionCategory =
  | 'Harvest'
  | 'Chemical'
  | 'Fertilizer'
  | 'Seed'
  | 'Grain Sale'
  | 'Insurance'
  | 'Govt Payment'
  | 'Fuel'
  | 'Machine Hire'
  | 'Tax'
  | 'Interest'
  | 'Other'
export type Unit = 'bu' | 'gal' | 'tons' | 'lbs'

export interface Profile {
  id: string
  farm_name: string | null
  settings: {
    default_currency?: string
    measurement_system?: string
    dashboard_crops?: string[]
    followed_elevators?: string[]
    gov_programs?: string[]
    /** Static dashboard snapshot configuration stored in profiles.settings JSON (farm-level). */
    dashboard_snapshot?: {
      bbox: {
        west: number
        south: number
        east: number
        north: number
      }
      image_url: string
      width: number
      height: number
      scale?: number
      created_at?: string
    }
    /** Optional saved camera for reopening Mapbox edit view at a sensible framing. */
    dashboard_camera?: {
      center: [number, number]
      zoom: number
      bearing: number
      pitch: number
    }
  }
  created_at: string
  updated_at: string
}

export interface Field {
  id: string
  user_id: string
  name: string
  acres: number | null
  gis_acres: number | null
  boundary: GeoJSON.Polygon | null
  created_at: string
  updated_at: string
}

export interface Season {
  id: string
  field_id: string
  year: number
  crop_type: CropType
  status: SeasonStatus
  landlord_share_percent: number | null
  landlord_name: string | null
  estimated_yield_per_acre: number | null
  actual_harvest_bushels: number | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  season_id: string
  contract_number: string | null
  buyer_name: string | null
  contract_type: ContractType
  quantity_bushels: number
  price_per_bushel: number | null
  delivery_deadline: string | null
  status: ContractStatus
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  season_id: string
  date: string
  type: TransactionType
  category: TransactionCategory
  vendor: string | null
  amount: number
  quantity: number | null
  unit: Unit | null
  receipt_url: string | null
  notes: string | null
  meta_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface FieldPnlRow {
  season_id: string
  field_id: string
  user_id: string
  field_name: string
  year: number
  crop_type: CropType
  landlord_share_percent: number | null
  field_acres: number | null
  total_harvested_bushels: number | null
  gross_revenue: number
  total_expenses: number
  net_income: number
  breakeven_price: number | null
  net_income_per_acre: number | null
}

declare global {
  namespace GeoJSON {
    interface Polygon {
      type: 'Polygon'
      coordinates: number[][][]
    }
  }
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }; Update: Partial<Profile> }
      fields: { Row: Field; Insert: Omit<Field, 'id' | 'created_at' | 'updated_at'> & { id?: string }; Update: Partial<Field> }
      seasons: { Row: Season; Insert: Omit<Season, 'id' | 'created_at' | 'updated_at'> & { id?: string }; Update: Partial<Season> }
      contracts: { Row: Contract; Insert: Omit<Contract, 'id' | 'created_at' | 'updated_at'> & { id?: string }; Update: Partial<Contract> }
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'> & { id?: string }; Update: Partial<Transaction> }
    }
    Views: {
      view_field_pnl: { Row: FieldPnlRow }
    }
  }
}
