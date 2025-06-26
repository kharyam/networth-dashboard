import { useState, useEffect, useMemo, ErrorInfo, Component } from 'react'
import { 
  Plus, 
  RefreshCw, 
  BarChart3, 
  Grid3X3, 
  List,
  Coins,
  AlertTriangle,
  X,
  ExternalLink,
} from 'lucide-react'
import { 
  PieChart, Pie, Cell,
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { pluginsApi, cryptoHoldingsApi } from '../services/api'
import { ManualEntrySchema } from '../types'
import SmartDynamicForm from '../components/SmartDynamicForm'

interface CryptoHolding {
  id: number
  institution_name: string
  crypto_symbol: string
  balance_tokens: number
  purchase_price_usd?: number
  purchase_date?: string
  wallet_address?: string
  notes?: string
  created_at: string
  updated_at: string
  current_price_usd?: number
  current_price_btc?: number
  current_value_usd?: number
  price_change_24h?: number
  price_last_updated?: string
}

type ViewMode = 'grid' | 'list' | 'charts'
type PriceMode = 'usd' | 'btc'

// Error boundary for chart components
class ChartErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chart Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-64 flex items-center justify-center text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Chart rendering error</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function CryptoHoldings() {
  const [cryptoHoldings, setCryptoHoldings] = useState<CryptoHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [priceMode, setPriceMode] = useState<PriceMode>('usd')
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  
  // Form states
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadCryptoHoldings()
    loadSchema()
  }, [])

  // Transform and validate API response data
  const transformCryptoHoldingData = (rawData: any[]): CryptoHolding[] => {
    console.log('Raw crypto API response:', rawData) // Debug logging
    
    if (!Array.isArray(rawData)) {
      console.warn('Expected array but got:', typeof rawData, rawData)
      return []
    }

    return rawData.map((item: any) => {
      // Ensure all required fields exist with proper types
      const transformed: CryptoHolding = {
        id: Number(item.id) || 0,
        institution_name: String(item.institution_name || ''),
        crypto_symbol: String(item.crypto_symbol || ''),
        balance_tokens: Number(item.balance_tokens) || 0,
        purchase_price_usd: item.purchase_price_usd ? Number(item.purchase_price_usd) : undefined,
        purchase_date: item.purchase_date || undefined,
        wallet_address: item.wallet_address || undefined,
        notes: item.notes || undefined,
        created_at: String(item.created_at || ''),
        updated_at: String(item.updated_at || ''),
        current_price_usd: item.current_price_usd ? Number(item.current_price_usd) : undefined,
        current_price_btc: item.current_price_btc ? Number(item.current_price_btc) : undefined,
        current_value_usd: item.current_value_usd ? Number(item.current_value_usd) : undefined,
        price_change_24h: item.price_change_24h ? Number(item.price_change_24h) : undefined,
        price_last_updated: item.price_last_updated || undefined,
      }

      return transformed
    }).filter(item => item.id > 0) // Filter out invalid entries
  }

  const loadCryptoHoldings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await cryptoHoldingsApi.getAll()
      const transformedData = transformCryptoHoldingData(data)
      setCryptoHoldings(transformedData)
    } catch (err) {
      console.error('Failed to load crypto holdings:', err)
      setError('Failed to load crypto holdings')
    } finally {
      setLoading(false)
    }
  }

  const loadSchema = async () => {
    try {
      const schemaData = await pluginsApi.getSchema('crypto_holdings')
      setSchema(schemaData)
    } catch (err) {
      console.error('Failed to load schema:', err)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      // Refresh prices first, then reload holdings
      await cryptoHoldingsApi.refreshAllPrices()
      await loadCryptoHoldings()
      setMessage({ type: 'success', text: 'Crypto holdings and prices refreshed successfully' })
    } catch (err) {
      console.error('Failed to refresh:', err)
      setMessage({ type: 'error', text: 'Failed to refresh crypto holdings' })
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddSubmit = (formData: any) => {
    setSubmitting(true)
    pluginsApi.processManualEntry('crypto_holdings', formData)
      .then(() => {
        setMessage({ type: 'success', text: 'Crypto holding added successfully' })
        setAddModalOpen(false)
        loadCryptoHoldings()
      })
      .catch((err) => {
        console.error('Failed to add crypto holding:', err)
        setMessage({ type: 'error', text: 'Failed to add crypto holding' })
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  // Helper function to format currency values
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'BTC') {
      return `₿${amount.toFixed(8)}`
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  // Helper function to format crypto amounts
  const formatCrypto = (amount: number, symbol: string) => {
    const decimals = amount < 1 ? 8 : amount < 10 ? 6 : 4
    return `${amount.toFixed(decimals)} ${symbol}`
  }

  // Calculate total portfolio value
  const totalPortfolioValue = useMemo(() => {
    return cryptoHoldings.reduce((total, holding) => {
      return total + (holding.current_value_usd || 0)
    }, 0)
  }, [cryptoHoldings])

  // Data for charts
  const portfolioDistributionData = useMemo(() => {
    const data = cryptoHoldings
      .filter(holding => holding.current_value_usd && holding.current_value_usd > 0)
      .map(holding => ({
        name: holding.crypto_symbol,
        value: holding.current_value_usd!,
        tokens: holding.balance_tokens,
      }))
      .sort((a, b) => b.value - a.value)
    
    return data
  }, [cryptoHoldings])

  const institutionDistributionData = useMemo(() => {
    const institutionMap = new Map<string, number>()
    
    cryptoHoldings.forEach(holding => {
      const value = holding.current_value_usd || 0
      const current = institutionMap.get(holding.institution_name) || 0
      institutionMap.set(holding.institution_name, current + value)
    })

    return Array.from(institutionMap.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [cryptoHoldings])

  // Colors for charts
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Coins className="h-8 w-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crypto Holdings</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your cryptocurrency portfolio</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Price mode toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setPriceMode('usd')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                priceMode === 'usd'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              USD
            </button>
            <button
              onClick={() => setPriceMode('btc')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                priceMode === 'btc'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              BTC
            </button>
          </div>

          {/* View mode controls */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'charts'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Prices</span>
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Crypto</span>
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(totalPortfolioValue)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Holdings Count</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{cryptoHoldings.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Cryptos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(cryptoHoldings.map(h => h.crypto_symbol)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'charts' && (
        <div className="space-y-6">
          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portfolio Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Portfolio Distribution</h3>
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={portfolioDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {portfolioDistributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>

            {/* Institution Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribution by Institution</h3>
              <ChartErrorBoundary>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={institutionDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {institutionDistributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Grid/List View */}
      {(viewMode === 'grid' || viewMode === 'list') && (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {cryptoHoldings.length === 0 ? (
            <div className={`${viewMode === 'grid' ? 'col-span-full' : ''} text-center py-12`}>
              <Coins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No crypto holdings found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by adding your first cryptocurrency holding.</p>
              <button
                onClick={() => setAddModalOpen(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Crypto</span>
              </button>
            </div>
          ) : (
            cryptoHoldings.map((holding) => (
              <div key={holding.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {holding.crypto_symbol}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{holding.institution_name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {holding.price_change_24h && (
                      <span className={`text-sm font-medium ${
                        holding.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {holding.price_change_24h >= 0 ? '+' : ''}{holding.price_change_24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Balance:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCrypto(holding.balance_tokens, holding.crypto_symbol)}
                    </span>
                  </div>
                  
                  {holding.current_price_usd && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Price ({priceMode.toUpperCase()}):
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {priceMode === 'usd' 
                          ? formatCurrency(holding.current_price_usd)
                          : holding.current_price_btc 
                            ? formatCurrency(holding.current_price_btc, 'BTC')
                            : 'N/A'
                        }
                      </span>
                    </div>
                  )}
                  
                  {holding.current_value_usd && (
                    <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-3">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Value:</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(holding.current_value_usd)}
                      </span>
                    </div>
                  )}
                  
                  {holding.wallet_address && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Wallet:</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">
                        {holding.wallet_address}
                      </span>
                    </div>
                  )}
                </div>

                {/* External links for price charts */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Price Charts:</span>
                    <div className="flex space-x-3">
                      <a
                        href={`https://www.coingecko.com/en/coins/${holding.crypto_symbol.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span>USD</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={`https://www.coingecko.com/en/coins/${holding.crypto_symbol.toLowerCase()}/btc`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
                      >
                        <span>BTC</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Modal */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Crypto Holding</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <SmartDynamicForm
              schema={schema}
              onSubmit={handleAddSubmit}
              loading={submitting}
              submitText="Add Crypto Holding"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default CryptoHoldings