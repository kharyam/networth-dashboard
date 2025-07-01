import axios from 'axios'
import { logger, criticalLogger } from '@/utils/logger'
import type { 
  NetWorthSummary, 
  Account, 
  AccountBalance, 
  StockHolding, 
  StockConsolidation,
  EquityGrant,
  VestingSchedule,
  RealEstate,
  ManualEntrySchema,
  Plugin,
  ApiResponse 
} from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth and logging
api.interceptors.request.use((config) => {
  logger.log('🌐 [Axios] REQUEST:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: `${config.baseURL}${config.url}`,
    params: config.params,
    data: config.data,
    headers: config.headers
  })
  
  // TODO: Add auth token when implemented
  return config
}, (error) => {
  criticalLogger.error('❌ [Axios] REQUEST ERROR:', error)
  return Promise.reject(error)
})

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    logger.log('✅ [Axios] RESPONSE:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      data: response.data,
      headers: response.headers
    })
    return response
  },
  (error) => {
    criticalLogger.error('❌ [Axios] RESPONSE ERROR:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      responseData: error.response?.data,
      requestData: error.config?.data
    })
    return Promise.reject(error)
  }
)

// Net Worth API
export const netWorthApi = {
  getSummary: (): Promise<NetWorthSummary> =>
    api.get('/net-worth').then(res => res.data),
  
  getHistory: (period: string = '1Y'): Promise<any[]> =>
    api.get(`/net-worth/history?period=${period}`).then(res => res.data),
}

// Accounts API
export const accountsApi = {
  getAll: (): Promise<Account[]> =>
    api.get('/accounts').then(res => res.data.accounts || []),
  
  getById: (id: number): Promise<Account> =>
    api.get(`/accounts/${id}`).then(res => res.data),
  
  create: (account: Partial<Account>): Promise<Account> =>
    api.post('/accounts', account).then(res => res.data),
  
  update: (id: number, account: Partial<Account>): Promise<Account> =>
    api.put(`/accounts/${id}`, account).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/accounts/${id}`).then(() => undefined),
}

// Balances API
export const balancesApi = {
  getAll: (): Promise<AccountBalance[]> =>
    api.get('/balances').then(res => res.data.balances || []),
  
  getByAccount: (accountId: number): Promise<AccountBalance[]> =>
    api.get(`/accounts/${accountId}/balances`).then(res => res.data.balances || []),
}

// Stocks API
export const stocksApi = {
  getAll: (): Promise<StockHolding[]> =>
    api.get('/stocks').then(res => res.data.stocks || []),
  
  getConsolidated: (): Promise<StockConsolidation[]> =>
    api.get('/stocks/consolidated').then(res => res.data.consolidated_stocks || []),
  
  create: (stock: Partial<StockHolding>): Promise<StockHolding> =>
    api.post('/stocks', stock).then(res => res.data),
  
  update: (id: number, stock: Partial<StockHolding>): Promise<StockHolding> =>
    api.put(`/stocks/${id}`, stock).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/stocks/${id}`).then(() => undefined),
}

// Equity Compensation API
export const equityApi = {
  getAll: (): Promise<EquityGrant[]> =>
    api.get('/equity').then(res => res.data.equity_grants || []),
  
  getVesting: (grantId: number): Promise<VestingSchedule[]> =>
    api.get(`/equity/${grantId}/vesting`).then(res => res.data.vesting || []),
  
  create: (grant: Partial<EquityGrant>): Promise<EquityGrant> =>
    api.post('/equity', grant).then(res => res.data),
  
  update: (id: number, grant: Partial<EquityGrant>): Promise<EquityGrant> =>
    api.put(`/equity/${id}`, grant).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/equity/${id}`).then(() => undefined),
}

// Real Estate API
export const realEstateApi = {
  getAll: (): Promise<RealEstate[]> =>
    api.get('/real-estate').then(res => res.data.real_estate || []),
  
  create: (property: Partial<RealEstate>): Promise<RealEstate> =>
    api.post('/real-estate', property).then(res => res.data),
  
  update: (id: number, property: Partial<RealEstate>): Promise<RealEstate> =>
    api.put(`/real-estate/${id}`, property).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/real-estate/${id}`).then(() => undefined),
}

// Cash Holdings API
export const cashHoldingsApi = {
  getAll: (): Promise<any[]> =>
    api.get('/cash-holdings').then(res => res.data.cash_holdings || []),
  
  create: (holding: any): Promise<any> =>
    api.post('/cash-holdings', holding).then(res => res.data),
  
  update: (id: number, holding: any): Promise<any> =>
    api.put(`/cash-holdings/${id}`, holding).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/cash-holdings/${id}`).then(() => undefined),
}

// Crypto Holdings API
export const cryptoHoldingsApi = {
  getAll: (): Promise<any[]> =>
    api.get('/crypto-holdings').then(res => res.data.crypto_holdings || []),
  
  create: (holding: any): Promise<any> =>
    api.post('/crypto-holdings', holding).then(res => res.data),
  
  update: (id: number, holding: any): Promise<any> =>
    api.put(`/crypto-holdings/${id}`, holding).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/crypto-holdings/${id}`).then(() => undefined),
  
  getPrice: (symbol: string): Promise<any> =>
    api.get(`/crypto/prices/${symbol}`).then(res => res.data),
  
  getPriceHistory: (days?: number): Promise<any> =>
    api.get(`/crypto/prices/history${days ? `?days=${days}` : ''}`).then(res => res.data),
  
  refreshPrice: (symbol: string): Promise<any> =>
    api.post(`/crypto/prices/refresh/${symbol}`).then(res => res.data),
  
  refreshAllPrices: (): Promise<any> =>
    api.post('/crypto/prices/refresh').then(res => res.data),
}

// Plugins API
export const pluginsApi = {
  getAll: (): Promise<Plugin[]> =>
    api.get('/plugins').then(res => res.data.plugins || []),
  
  getSchema: (pluginName: string): Promise<ManualEntrySchema> =>
    api.get(`/plugins/${pluginName}/schema`).then(res => res.data),
  
  getSchemaForCategory: (pluginName: string, categoryId: number): Promise<ManualEntrySchema> =>
    api.get(`/plugins/${pluginName}/schema/${categoryId}`).then(res => res.data),
  
  processManualEntry: (pluginName: string, data: any): Promise<ApiResponse<any>> =>
    api.post(`/plugins/${pluginName}/manual-entry`, data).then(res => res.data),
  
  refresh: (): Promise<ApiResponse<any>> =>
    api.post('/plugins/refresh').then(res => res.data),
  
  getHealth: (): Promise<any> =>
    api.get('/plugins/health').then(res => res.data),
}

// Manual Entries API
export const manualEntriesApi = {
  getAll: (): Promise<any[]> =>
    api.get('/manual-entries').then(res => res.data.manual_entries || []),
  
  getSchemas: (): Promise<Record<string, ManualEntrySchema>> =>
    api.get('/manual-entries/schemas').then(res => res.data.schemas || {}),
  
  create: (entry: any): Promise<any> =>
    api.post('/manual-entries', entry).then(res => res.data),
  
  update: (id: number, entryType: string, entry: any): Promise<any> =>
    api.put(`/manual-entries/${id}?type=${entryType}`, entry).then(res => res.data),
  
  delete: (id: number, entryType: string): Promise<void> =>
    api.delete(`/manual-entries/${id}?type=${entryType}`).then(() => undefined),
}

// Other Assets API
export const otherAssetsApi = {
  getAll: (categoryFilter?: string): Promise<any> => {
    const url = categoryFilter 
      ? `/other-assets?category=${categoryFilter}`
      : '/other-assets'
    return api.get(url).then(res => res.data)
  },
  
  create: (asset: any): Promise<any> =>
    api.post('/other-assets', asset).then(res => res.data),
  
  update: (id: number, asset: any): Promise<any> =>
    api.put(`/other-assets/${id}`, asset).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/other-assets/${id}`).then(() => undefined),
}

// Asset Categories API
export const assetCategoriesApi = {
  getAll: (): Promise<any[]> =>
    api.get('/asset-categories').then(res => res.data.asset_categories || []),
  
  getById: (id: number): Promise<any> =>
    api.get(`/asset-categories/${id}`).then(res => res.data),
  
  create: (category: any): Promise<any> =>
    api.post('/asset-categories', category).then(res => res.data),
  
  update: (id: number, category: any): Promise<any> =>
    api.put(`/asset-categories/${id}`, category).then(res => res.data),
  
  delete: (id: number): Promise<void> =>
    api.delete(`/asset-categories/${id}`).then(() => undefined),
  
  getSchema: (id: number): Promise<any> =>
    api.get(`/asset-categories/${id}/schema`).then(res => res.data),
}

// Price Management API
export const pricesApi = {
  // Smart refresh - respects cache and market hours logic
  refreshAll: (force: boolean = false): Promise<any> => {
    const url = `/prices/refresh${force ? '?force=true' : ''}`
    const context = force ? 'FORCE_REFRESH' : 'SMART_REFRESH'
    logger.log(`🔄 [pricesApi.refreshAll] Making request:`, { context, force, url, method: 'POST' })
    return api.post(url).then(res => res.data.summary)
  },

  // Convenience method for auto-refresh (page loads, navigation)
  autoRefresh: (): Promise<any> => {
    logger.log('🔄 [pricesApi.autoRefresh] Auto-refreshing with smart cache logic')
    return pricesApi.refreshAll(false)
  },

  // Convenience method for user-initiated force refresh
  forceRefresh: (): Promise<any> => {
    logger.log('🔄 [pricesApi.forceRefresh] Force refreshing - bypassing cache')
    return pricesApi.refreshAll(true)
  },
  
  refreshSymbol: (symbol: string, force: boolean = false): Promise<any> => {
    const url = `/prices/refresh/${symbol}${force ? '?force=true' : ''}`
    logger.log('🔄 [pricesApi.refreshSymbol] Refreshing symbol:', { symbol, force, url })
    return api.post(url).then(res => res.data.result)
  },
  
  getStatus: (): Promise<any> =>
    api.get('/prices/status').then(res => res.data),
}

// Market Status API
export const marketApi = {
  getStatus: (): Promise<any> =>
    api.get('/market/status').then(res => res.data),
}

// Property Valuation API
export const propertyValuationApi = {
  getValuation: (params: {
    address?: string,
    city?: string,
    state?: string,
    zip_code?: string
  }): Promise<any> => {
    const searchParams = new URLSearchParams()
    if (params.address) searchParams.set('address', params.address)
    if (params.city) searchParams.set('city', params.city)
    if (params.state) searchParams.set('state', params.state)
    if (params.zip_code) searchParams.set('zip_code', params.zip_code)
    
    return api.get(`/property-valuation?${searchParams.toString()}`).then(res => res.data)
  },
  
  refreshValuation: (params: {
    address?: string,
    city?: string,
    state?: string,
    zip_code?: string
  }): Promise<any> => {
    const searchParams = new URLSearchParams()
    if (params.address) searchParams.set('address', params.address)
    if (params.city) searchParams.set('city', params.city)
    if (params.state) searchParams.set('state', params.state)
    if (params.zip_code) searchParams.set('zip_code', params.zip_code)
    
    return api.post(`/property-valuation/refresh?${searchParams.toString()}`).then(res => res.data)
  },
  
  getProviders: (): Promise<any> =>
    api.get('/property-valuation/providers').then(res => res.data),
    
  checkFeatureStatus: (): Promise<{ feature_enabled: boolean; message?: string }> =>
    api.get('/property-valuation/providers').then(res => ({
      feature_enabled: res.data.feature_enabled !== false,
      message: res.data.message
    })),
}

export default api