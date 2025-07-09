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
  institution_name: string
  data_source: string
  estimated_quarterly_dividend?: number
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
  current_price?: number
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
  property_type: string
  property_name: string
  street_address?: string
  city?: string
  state?: string
  zip_code?: string
  latitude?: number
  longitude?: number
  purchase_price: number
  current_value: number
  outstanding_mortgage: number
  equity: number
  purchase_date: string
  property_size_sqft?: number
  lot_size_acres?: number
  rental_income_monthly?: number
  property_tax_annual?: number
  notes?: string
  api_estimated_value?: number
  api_estimate_date?: string
  api_provider?: string
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
  cash_holdings_value: number
  crypto_holdings_value: number
  other_assets_value?: number
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
  description?: string
  required: boolean
  placeholder?: string
  default_value?: any
  options?: FieldOption[]
  validation?: FieldValidation
}

export interface FieldOption {
  value: string
  label: string
}

export interface FieldValidation {
  pattern?: string
  min?: number
  max?: number
  min_length?: number
  max_length?: number
  required?: boolean
}

export interface ManualEntrySchema {
  name: string
  description: string
  version: string
  fields: ManualEntryField[]
}

export interface Plugin {
  name: string
  friendly_name: string
  type: string
  data_source: string
  version: string
  description: string
  enabled: boolean
  status: string
  health: PluginHealth
}

export interface PluginHealth {
  status: string
  last_checked: string
  message?: string
  metrics: PluginMetrics
}

export interface PluginMetrics {
  request_count: number
  error_count: number
  success_rate: number
  last_update: string
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

export interface CryptoPriceHistoryPoint {
  timestamp: string
  price_usd: number
  price_btc: number
}

export interface CryptoPriceHistory {
  symbol: string
  data: CryptoPriceHistoryPoint[]
}

export interface CryptoPriceHistoryResponse {
  price_history: CryptoPriceHistory[]
  start_date: string
  days_back: number
  total_symbols: number
  disclaimer: string
}

export interface CryptoPriceUpdateResult {
  symbol: string
  old_price_usd: number
  new_price_usd: number
  old_price_btc: number
  new_price_btc: number
  updated: boolean
  error?: string
  error_type?: string // "rate_limited", "api_error", "invalid_symbol", "cache_error"
  timestamp: string
  source: string // "api", "cache"
  price_change_usd: number // Absolute change in USD
  price_change_pct: number // Percentage change in USD
  cache_age?: string // How old the previous cached price was
}

export interface CryptoPriceRefreshSummary {
  total_symbols: number
  updated_symbols: number
  failed_symbols: number
  results: CryptoPriceUpdateResult[]
  provider_name: string
  timestamp: string
  duration_ms: number
}

export interface PassiveIncomeSource {
  source: string
  monthly_amount: number
  annual_amount: number
  percentage: number
}

export interface PassiveIncomeSummary {
  cash_interest_monthly: number
  stock_dividends_monthly: number
  real_estate_income_monthly: number
  crypto_staking_monthly: number
}

export interface PassiveIncomeData {
  total_monthly_income: number
  total_annual_income: number
  income_breakdown: PassiveIncomeSource[]
  summary: PassiveIncomeSummary
  last_updated: string
}