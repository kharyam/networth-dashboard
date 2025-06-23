export interface Account {
  id: number
  data_source_id?: number
  external_account_id?: string
  account_name: string
  account_type: string
  institution: string
  data_source_type: string
  created_at: string
  updated_at: string
}

export interface AccountBalance {
  id: number
  account_id: number
  balance: number
  currency: string
  timestamp: string
  data_source: string
}

export interface StockHolding {
  id: number
  account_id: number
  symbol: string
  company_name?: string
  shares_owned: number
  cost_basis?: number
  current_price?: number
  market_value?: number
  data_source: string
  last_price_update?: string
  last_manual_update?: string
  created_at: string
}

export interface EquityGrant {
  id: number
  account_id: number
  grant_id?: string
  grant_type: string
  company_symbol?: string
  total_shares: number
  vested_shares: number
  unvested_shares: number
  strike_price?: number
  grant_date?: string
  vest_start_date?: string
  data_source: string
  created_at: string
}

export interface VestingSchedule {
  id: number
  grant_id: number
  vest_date: string
  shares_vesting: number
  cumulative_vested: number
  is_future_vest: boolean
  data_source: string
  created_at: string
}

export interface RealEstate {
  id: number
  account_id: number
  property_address?: string
  property_type?: string
  estimated_value: number
  purchase_price?: number
  purchase_date?: string
  mortgage_balance?: number
  equity_value?: number
  value_source?: string
  last_value_update?: string
  created_at: string
}

export interface NetWorthSummary {
  net_worth: number
  total_assets: number
  total_liabilities: number
  vested_equity_value: number
  unvested_equity_value: number
  stock_holdings_value: number
  real_estate_equity: number
  last_updated: string
}

export interface StockConsolidation {
  symbol: string
  company_name: string
  total_shares: number
  total_value: number
  current_price: number
  unrealized_gains: number
  sources: StockHolding[]
}

export interface ManualEntryField {
  name: string
  type: string
  label: string
  required: boolean
  placeholder?: string
  options?: string[]
  validation?: Record<string, any>
}

export interface ManualEntrySchema {
  fields: ManualEntryField[]
  validation_rules: ValidationRule[]
  update_frequency: string
}

export interface ValidationRule {
  field: string
  rule: string
  message: string
}

export interface Plugin {
  name: string
  type: string
  status: string
  supports_manual_entry: boolean
}

export interface ApiResponse<T> {
  data?: T
  message?: string
  error?: string
}

export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface AllocationData {
  name: string
  value: number
  color: string
  percentage: number
}