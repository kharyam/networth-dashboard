import { useState, useEffect, useMemo, Component, ErrorInfo } from 'react'
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
  Clock,
  Edit2,
  Eye,
  Trash2,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { 
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer 
} from 'recharts'
import { pluginsApi, cryptoHoldingsApi } from '@/services/api'
import { ManualEntrySchema } from '@/types'
import SmartDynamicForm from '@/components/SmartDynamicForm'
import EditEntryModal from '@/components/EditEntryModal'
import { formatCurrency, formatNumber } from '@/utils/formatting'

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

type ViewMode = 'grid' | 'list' | 'charts' | 'history'
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
  const [holdings, setHoldings] = useState<CryptoHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [priceMode, setPriceMode] = useState<PriceMode>('usd')
  const [individualPriceModes, setIndividualPriceModes] = useState<Record<number, PriceMode>>({})
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<CryptoHolding | null>(null)
  
  // Form states
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // History state
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadHoldings()
    loadSchema()
    // Refresh prices on component mount to ensure fresh data
    refreshPrices()
  }, [])

  const refreshPrices = async () => {
    try {
      await cryptoHoldingsApi.refreshAllPrices()
      // Reload holdings after price refresh to get updated data
      await loadHoldings()
    } catch (err) {
      console.error('Failed to refresh crypto prices:', err)
      // Don't set error state since this is background refresh
    }
  }

  const loadHoldings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await cryptoHoldingsApi.getAll()
      setHoldings(data)
    } catch (err) {
      console.error('Failed to load crypto holdings:', err)
      setError('Failed to load crypto holdings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const refreshHoldings = async () => {
    try {
      setRefreshing(true)
      setError(null)
      // First refresh all crypto prices
      await cryptoHoldingsApi.refreshAllPrices()
      // Then reload holdings with updated prices
      const data = await cryptoHoldingsApi.getAll()
      setHoldings(data)
    } catch (err) {
      console.error('Failed to refresh crypto holdings:', err)
      setError('Failed to refresh crypto holdings. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const loadSchema = async () => {
    try {
      const cryptoSchema = await pluginsApi.getSchema('crypto_holdings')
      setSchema(cryptoSchema)
    } catch (error) {
      console.error('Failed to load crypto schema:', error)
    }
  }

  const loadPriceHistory = async () => {
    if (holdings.length === 0) return
    
    try {
      setHistoryLoading(true)
      await cryptoHoldingsApi.getPriceHistory(30)
    } catch (error) {
      console.error('Failed to load price history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'history') {
      loadPriceHistory()
    }
  }, [viewMode, holdings])

  const handleAddHolding = async (formData: Record<string, any>) => {
    setSubmitting(true)
    setMessage(null)

    try {
      await pluginsApi.processManualEntry('crypto_holdings', formData)
      setMessage({ type: 'success', text: 'Crypto holding added successfully!' })
      
      await loadHoldings()
      setAddModalOpen(false)
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to add crypto holding:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add crypto holding. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateHolding = async (formData: Record<string, any>) => {
    if (!selectedHolding) return

    try {
      await cryptoHoldingsApi.update(selectedHolding.id, formData)
      setMessage({ type: 'success', text: 'Crypto holding updated successfully!' })
      
      await loadHoldings()
      closeModals()
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to update crypto holding:', error)
      const errorMessage = error.response?.data?.error || 'Failed to update crypto holding. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    }
  }

  const handleDeleteHolding = async () => {
    if (!selectedHolding) return

    try {
      await cryptoHoldingsApi.delete(selectedHolding.id)
      await loadHoldings()
      closeModals()
      setMessage({ type: 'success', text: 'Crypto holding deleted successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete crypto holding:', err)
      setError('Failed to delete crypto holding. Please try again.')
    }
  }

  const closeModals = () => {
    setAddModalOpen(false)
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedHolding(null)
  }

  const clearMessage = () => {
    setMessage(null)
  }

  const clearError = () => {
    setError(null)
  }

  // Helper functions
  const formatCrypto = (amount: number, symbol: string) => {
    return `${formatNumber(amount)} ${symbol}`
  }

  const convertToBTC = (usdAmount: number): number => {
    const btcPrice = holdings.find(h => h.crypto_symbol === 'BTC')?.current_price_usd || 50000
    return usdAmount / btcPrice
  }

  const toggleIndividualPriceMode = (holdingId: number) => {
    setIndividualPriceModes(prev => ({
      ...prev,
      [holdingId]: prev[holdingId] === 'btc' ? 'usd' : 'btc'
    }))
  }

  const getIndividualPriceMode = (holdingId: number): PriceMode => {
    return individualPriceModes[holdingId] || 'usd'
  }

  const getCoinGeckoId = (symbol: string) => {
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'LTC': 'litecoin',
      'XRP': 'ripple',
      'BCH': 'bitcoin-cash',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'MATIC': 'polygon',
      'AVAX': 'avalanche-2',
      'ATOM': 'cosmos',
      'NEAR': 'near',
      'FTM': 'fantom',
      'ALGO': 'algorand',
      'XLM': 'stellar',
      'VET': 'vechain',
      'ICP': 'internet-computer',
      'THETA': 'theta-token',
      'FIL': 'filecoin',
      'TRX': 'tron',
      'EOS': 'eos',
      'XMR': 'monero',
      'AAVE': 'aave',
      'MKR': 'maker',
      'COMP': 'compound-coin',
      'SUSHI': 'sushi',
      '1INCH': '1inch',
      'CRV': 'curve-dao-token'
    }
    
    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase()
  }

  // Calculations
  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value_usd || 0), 0)
  const totalChange24h = holdings.reduce((sum, h) => {
    if (h.price_change_24h && h.current_value_usd) {
      const previousValue = h.current_value_usd / (1 + h.price_change_24h / 100)
      const change = h.current_value_usd - previousValue
      return sum + change
    }
    return sum
  }, 0)

  const portfolioChange24hPercent = totalValue > 0 ? (totalChange24h / (totalValue - totalChange24h)) * 100 : 0

  // Group holdings by institution
  const groupedHoldings = useMemo(() => {
    const groups = holdings.reduce((acc, holding) => {
      const key = holding.institution_name
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(holding)
      return acc
    }, {} as Record<string, CryptoHolding[]>)

    return Object.entries(groups).map(([institutionName, groupHoldings]) => ({
      institutionName,
      holdings: groupHoldings,
      totalValue: groupHoldings.reduce((sum, h) => sum + (h.current_value_usd || 0), 0)
    }))
  }, [holdings])

  // Charts data
  const pieData = holdings
    .filter(h => h.current_value_usd && h.current_value_usd > 0)
    .map(holding => ({
      name: holding.crypto_symbol,
      value: holding.current_value_usd || 0,
      valueBTC: convertToBTC(holding.current_value_usd || 0)
    }))

  // Institution-based pie chart data
  const institutionPieData = useMemo(() => {
    const institutionMap = new Map<string, { value: number, valueBTC: number }>()
    
    holdings
      .filter(h => h.current_value_usd && h.current_value_usd > 0)
      .forEach(holding => {
        const institution = holding.institution_name || 'Unknown Exchange'
        const value = holding.current_value_usd || 0
        const valueBTC = convertToBTC(value)
        
        const existing = institutionMap.get(institution) || { value: 0, valueBTC: 0 }
        institutionMap.set(institution, {
          value: existing.value + value,
          valueBTC: existing.valueBTC + valueBTC
        })
      })
    
    return Array.from(institutionMap.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      valueBTC: data.valueBTC
    }))
  }, [holdings])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

  // Generate pie chart data for a specific institution
  const getInstitutionPieData = (institutionHoldings: CryptoHolding[]) => {
    return institutionHoldings
      .filter(h => h.current_value_usd && h.current_value_usd > 0)
      .map(holding => ({
        name: holding.crypto_symbol,
        value: holding.current_value_usd || 0,
        valueBTC: convertToBTC(holding.current_value_usd || 0)
      }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Coins className="w-8 h-8 mr-3 text-primary-600" />
            Crypto Holdings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your cryptocurrency portfolio across exchanges and wallets
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Global Price Mode Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setPriceMode('usd')}
              className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
                priceMode === 'usd'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              USD
            </button>
            <button
              onClick={() => setPriceMode('btc')}
              className={`px-3 py-2 text-sm font-medium rounded transition-colors ${
                priceMode === 'btc'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              BTC
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'charts'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-3 py-2 text-sm font-medium rounded-r-lg ${
                viewMode === 'history'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={refreshHoldings}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Holding
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`card border-l-4 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
        }`}>
          <div className="flex items-center justify-between">
            <p className={`${
              message.type === 'success' 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </p>
            <button onClick={clearMessage} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={clearError} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Portfolio Value</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {priceMode === 'btc' ? formatCurrency(convertToBTC(totalValue), { currency: 'BTC' }) : formatCurrency(totalValue)}
            </p>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">24h Change</h3>
            <div className="flex items-center">
              {portfolioChange24hPercent >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500 mr-1" />
              )}
              <span className={`text-2xl font-bold ${
                portfolioChange24hPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {portfolioChange24hPercent >= 0 ? '+' : ''}{portfolioChange24hPercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Holdings</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {holdings.length}
            </p>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Exchanges</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(holdings.map(h => h.institution_name)).size}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'charts' ? (
        <ChartErrorBoundary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Portfolio Distribution by Asset</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => {
                      if (priceMode === 'btc') {
                        return [formatCurrency(props.payload.valueBTC, { currency: 'BTC' }), 'Value']
                      }
                      return [formatCurrency(value), 'Value']
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Holdings by Institution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={institutionPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {institutionPieData.map((_, index) => (
                      <Cell key={`cell-institution-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, _name: string, props: any) => {
                      if (priceMode === 'btc') {
                        return [formatCurrency(props.payload.valueBTC, { currency: 'BTC' }), 'Value']
                      }
                      return [formatCurrency(value), 'Value']
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartErrorBoundary>
      ) : viewMode === 'history' ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Price History (30 Days)</h3>
          {historyLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Price history chart would be displayed here</p>
          )}
        </div>
      ) : holdings.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <Coins className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No crypto holdings found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by adding your first cryptocurrency holding.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Holding
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View - Individual Crypto Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {holdings.map((holding) => (
            <div key={holding.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {holding.crypto_symbol}
                  </span>
                  <a
                    href={`https://www.coingecko.com/en/coins/${getCoinGeckoId(holding.crypto_symbol)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    title="View on CoinGecko"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <button
                  onClick={() => toggleIndividualPriceMode(holding.id)}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                  title={`Switch to ${getIndividualPriceMode(holding.id) === 'usd' ? 'BTC' : 'USD'}`}
                >
                  {getIndividualPriceMode(holding.id) === 'usd' ? '₿' : '$'}
                </button>
              </div>

              {/* Institution */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {holding.institution_name}
              </p>

              {/* Balance */}
              <div className="mb-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">
                  {formatCrypto(holding.balance_tokens, holding.crypto_symbol)}
                </p>
              </div>

              {/* Value */}
              <div className="mb-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">Value</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {getIndividualPriceMode(holding.id) === 'btc' 
                    ? formatCurrency(convertToBTC(holding.current_value_usd || 0), { currency: 'BTC' })
                    : formatCurrency(holding.current_value_usd || 0)
                  }
                </p>
              </div>

              {/* 24h Change */}
              {holding.price_change_24h && (
                <div className="mb-3">
                  <div className="flex items-center gap-1">
                    {holding.price_change_24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${
                      holding.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {holding.price_change_24h >= 0 ? '+' : ''}{holding.price_change_24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => {
                    setSelectedHolding(holding)
                    setViewModalOpen(true)
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedHolding(holding)
                    setEditModalOpen(true)
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedHolding(holding)
                    setDeleteModalOpen(true)
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View - Grouped by Institution */
        <div className="space-y-6">
          {groupedHoldings.map(({ institutionName, holdings: institutionHoldings, totalValue: institutionTotal }) => (
            <div key={institutionName} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {/* Institution Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Institution Pie Chart */}
                  <div className="flex-shrink-0">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width={60} height={60}>
                        <PieChart>
                          <Pie
                            data={getInstitutionPieData(institutionHoldings)}
                            cx="50%"
                            cy="50%"
                            outerRadius={25}
                            fill="#8884d8"
                            dataKey="value"
                            stroke="none"
                          >
                            {getInstitutionPieData(institutionHoldings).map((_, index) => (
                              <Cell key={`cell-${institutionName}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, _name: string, props: any) => {
                              if (priceMode === 'btc') {
                                return [formatCurrency(props.payload.valueBTC, { currency: 'BTC' }), 'Value']
                              }
                              return [formatCurrency(value), 'Value']
                            }}
                            labelFormatter={(name) => `${name}`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {institutionName}
                      </h3>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {priceMode === 'btc' 
                          ? formatCurrency(convertToBTC(institutionTotal), { currency: 'BTC' })
                          : formatCurrency(institutionTotal)
                        }
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {institutionHoldings.length} holding{institutionHoldings.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Holdings List */}
              <div className="space-y-3">
                {institutionHoldings.map((holding) => (
                  <div key={holding.id} className="border-l-4 border-blue-500 pl-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {holding.crypto_symbol}
                        </span>
                        <a
                          href={`https://www.coingecko.com/en/coins/${getCoinGeckoId(holding.crypto_symbol)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View on CoinGecko"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => toggleIndividualPriceMode(holding.id)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          title={`Switch to ${getIndividualPriceMode(holding.id) === 'usd' ? 'BTC' : 'USD'}`}
                        >
                          {getIndividualPriceMode(holding.id) === 'usd' ? '₿' : '$'}
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        {holding.price_change_24h && (
                          <span className={`text-xs font-medium ${
                            holding.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {holding.price_change_24h >= 0 ? '+' : ''}{holding.price_change_24h.toFixed(2)}%
                          </span>
                        )}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setSelectedHolding(holding)
                              setViewModalOpen(true)
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHolding(holding)
                              setEditModalOpen(true)
                            }}
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHolding(holding)
                              setDeleteModalOpen(true)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {formatCrypto(holding.balance_tokens, holding.crypto_symbol)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {getIndividualPriceMode(holding.id) === 'btc' 
                          ? formatCurrency(convertToBTC(holding.current_value_usd || 0), { currency: 'BTC' })
                          : formatCurrency(holding.current_value_usd || 0)
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Holding Modal */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add New Crypto Holding
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <SmartDynamicForm
                schema={schema}
                onSubmit={handleAddHolding}
                loading={submitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Holding Modal */}
      <EditEntryModal
        entryType="crypto_holdings"
        entryData={selectedHolding || {}}
        title="Edit Crypto Holding"
        isOpen={editModalOpen && !!selectedHolding}
        onClose={closeModals}
        onUpdate={handleUpdateHolding}
        submitText="Update Holding"
        schemaOverride={schema || undefined}
      />

      {/* View Modal */}
      {viewModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Crypto Holding Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Cryptocurrency</h4>
                <p className="text-gray-900 dark:text-white">{selectedHolding.crypto_symbol}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Institution</h4>
                <p className="text-gray-900 dark:text-white">{selectedHolding.institution_name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance</h4>
                <p className="text-gray-900 dark:text-white">{formatCrypto(selectedHolding.balance_tokens, selectedHolding.crypto_symbol)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Value</h4>
                <p className="text-gray-900 dark:text-white">{formatCurrency(selectedHolding.current_value_usd || 0)}</p>
              </div>
              {selectedHolding.purchase_price_usd && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Purchase Price</h4>
                  <p className="text-gray-900 dark:text-white">{formatCurrency(selectedHolding.purchase_price_usd)}</p>
                </div>
              )}
              {selectedHolding.wallet_address && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Wallet Address</h4>
                  <p className="text-gray-900 dark:text-white font-mono text-sm break-all">{selectedHolding.wallet_address}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Crypto Holding
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete this {selectedHolding.crypto_symbol} holding from {selectedHolding.institution_name}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteHolding}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CryptoHoldings