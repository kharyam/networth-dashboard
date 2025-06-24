import axios from 'axios'
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

// Request interceptor for auth
api.interceptors.request.use((config) => {
  // TODO: Add auth token when implemented
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
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

// Plugins API
export const pluginsApi = {
  getAll: (): Promise<Plugin[]> =>
    api.get('/plugins').then(res => res.data.plugins || []),
  
  getSchema: (pluginName: string): Promise<ManualEntrySchema> =>
    api.get(`/plugins/${pluginName}/schema`).then(res => res.data),
  
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
  
  update: (id: number, entry: any): Promise<any> =>
    api.put(`/manual-entries/${id}`, entry).then(res => res.data),
  
  delete: (id: number, entryType: string): Promise<void> =>
    api.delete(`/manual-entries/${id}?type=${entryType}`).then(() => undefined),
}

export default api