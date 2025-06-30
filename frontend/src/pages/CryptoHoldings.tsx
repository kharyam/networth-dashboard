import React, { useState, useEffect, Component, ErrorInfo } from 'react'
import { Coins, ExternalLink, Eye, Edit2, Trash2, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import GenericAssetPage, { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { cryptoHoldingsApi, pluginsApi } from '@/services/api'
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

// Transform and validate API response data
const transformCryptoData = (rawData: any[]): CryptoHolding[] => {
  if (!Array.isArray(rawData)) {
    console.warn('Invalid crypto holdings data format:', rawData)
    return []
  }

  return rawData
    .map(item => ({
      id: parseInt(item.id) || 0,
      institution_name: String(item.institution_name || 'Unknown'),
      crypto_symbol: String(item.crypto_symbol || '').toUpperCase(),
      balance_tokens: parseFloat(item.balance_tokens) || 0,
      purchase_price_usd: item.purchase_price_usd ? parseFloat(item.purchase_price_usd) : undefined,
      purchase_date: item.purchase_date || undefined,
      wallet_address: item.wallet_address || undefined,
      notes: item.notes || undefined,
      created_at: item.created_at || '',
      updated_at: item.updated_at || '',
      current_price_usd: item.current_price_usd ? parseFloat(item.current_price_usd) : undefined,
      current_price_btc: item.current_price_btc ? parseFloat(item.current_price_btc) : undefined,
      current_value_usd: item.current_value_usd ? parseFloat(item.current_value_usd) : undefined,
      price_change_24h: item.price_change_24h ? parseFloat(item.price_change_24h) : undefined,
      price_last_updated: item.price_last_updated || undefined
    }))
    .filter(holding => holding.id > 0 && holding.crypto_symbol && holding.balance_tokens > 0)
}


// Custom crypto card renderer for individual holdings
const CryptoCard = (
  holding: CryptoHolding,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
) => (
  <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="flex items-center mb-2">
          <Coins className="w-5 h-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {holding.crypto_symbol}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {holding.institution_name}
        </p>
        {holding.wallet_address && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {holding.wallet_address.slice(0, 8)}...{holding.wallet_address.slice(-6)}
          </p>
        )}
      </div>
    </div>

    {/* Token Balance */}
    <div className="mb-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">
        {formatNumber(holding.balance_tokens, { maximumFractionDigits: 8 })} {holding.crypto_symbol}
      </p>
    </div>

    {/* Current Value */}
    <div className="mb-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Current Value</p>
      <p className="text-xl font-bold text-green-600 dark:text-green-400">
        {formatCurrency(holding.current_value_usd || 0)}
      </p>
    </div>

    {/* Price Info */}
    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
      {holding.current_price_usd && (
        <div>
          <p className="text-gray-500 dark:text-gray-400">Price</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(holding.current_price_usd)}
          </p>
        </div>
      )}
      {holding.price_change_24h !== undefined && (
        <div>
          <p className="text-gray-500 dark:text-gray-400">24h Change</p>
          <p className={`font-medium flex items-center ${
            holding.price_change_24h >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {holding.price_change_24h >= 0 ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {Math.abs(holding.price_change_24h).toFixed(2)}%
          </p>
        </div>
      )}
    </div>

    {/* External chart link */}
    {['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI'].includes(holding.crypto_symbol) && (
      <div className="mb-4">
        <a
          href={`https://www.coingecko.com/en/coins/${holding.crypto_symbol.toLowerCase()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          View on CoinGecko
        </a>
      </div>
    )}

    {/* Action Buttons */}
    <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-600">
      <button
        onClick={actions.onView}
        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
        title="View Details"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={actions.onEdit}
        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
        title="Edit"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={actions.onDelete}
        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
)

// Summary cards renderer
const CryptoSummaryCards = (holdings: CryptoHolding[]) => {
  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value_usd || 0), 0)
  const totalSymbols = new Set(holdings.map(h => h.crypto_symbol)).size
  const totalInstitutions = new Set(holdings.map(h => h.institution_name)).size
  const avgHoldingValue = holdings.length > 0 ? totalValue / holdings.length : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Value</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalValue)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Crypto Assets</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {totalSymbols}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Institutions</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {totalInstitutions}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Avg Holding</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(avgHoldingValue)}
        </p>
      </div>
    </div>
  )
}

// Chart functionality
const CryptoCharts = (holdings: CryptoHolding[]): JSX.Element => {
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']

  // Get current BTC price for conversions
  const btcPrice = (() => {
    const btcHolding = holdings.find(h => h.crypto_symbol === 'BTC')
    return btcHolding?.current_price_usd || 45000 // Fallback BTC price
  })()

  // Helper function to convert USD to BTC
  const convertToBTC = (usdAmount: number) => {
    return usdAmount / btcPrice
  }

  // Portfolio distribution data (by crypto symbol)
  const portfolioDistributionData = (() => {
    const symbolMap = new Map<string, { value: number, tokens: number }>()
    
    holdings
      .filter(holding => holding.current_value_usd && holding.current_value_usd > 0)
      .forEach(holding => {
        const existing = symbolMap.get(holding.crypto_symbol) || { value: 0, tokens: 0 }
        symbolMap.set(holding.crypto_symbol, {
          value: existing.value + holding.current_value_usd!,
          tokens: existing.tokens + holding.balance_tokens
        })
      })

    return Array.from(symbolMap.entries())
      .map(([symbol, { value, tokens }]) => ({
        name: symbol,
        value,
        valueBTC: convertToBTC(value),
        tokens,
      }))
      .sort((a, b) => b.value - a.value)
  })()

  // Institution distribution data
  const institutionDistributionData = (() => {
    const institutionMap = new Map<string, number>()
    
    holdings.forEach(holding => {
      const value = holding.current_value_usd || 0
      const current = institutionMap.get(holding.institution_name) || 0
      institutionMap.set(holding.institution_name, current + value)
    })

    return Array.from(institutionMap.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ 
        name, 
        value,
        valueBTC: convertToBTC(value)
      }))
      .sort((a, b) => b.value - a.value)
  })()

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No crypto holdings data available for charts</p>
      </div>
    )
  }

  return (
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
  )
}

// Price History functionality
const CryptoHistory = (_holdings: CryptoHolding[]): JSX.Element => {
  const [priceHistory, setPriceHistory] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const loadPriceHistory = async () => {
    try {
      setHistoryLoading(true)
      setHistoryError(null)
      const data = await cryptoHoldingsApi.getPriceHistory()
      setPriceHistory(data)
    } catch (error: any) {
      console.error('Failed to load price history:', error)
      setHistoryError('Failed to load price history data')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadPriceHistory()
  }, [])

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Cached Price Data Disclaimer
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              {priceHistory?.disclaimer || 'This data represents cached price snapshots taken during application usage and may not reflect complete or real-time market data.'}
            </p>
          </div>
        </div>
      </div>

      {/* Price History Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Crypto Price History (USD)
        </h3>
        
        {historyLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : historyError ? (
          <div className="flex items-center justify-center h-64 text-red-500 dark:text-red-400">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{historyError}</p>
              <button
                onClick={loadPriceHistory}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : !priceHistory || priceHistory.price_history.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No price history data available</p>
              <p className="text-sm mt-2">Price data will accumulate as you use the application</p>
            </div>
          </div>
        ) : (
          <ChartErrorBoundary>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(() => {
                  // Combine all data points with timestamps as the key
                  const allDataPoints = new Map()
                  
                  priceHistory.price_history.forEach((crypto: any) => {
                    crypto.data.forEach((point: any) => {
                      const timestamp = point.timestamp
                      if (!allDataPoints.has(timestamp)) {
                        allDataPoints.set(timestamp, { timestamp })
                      }
                      const dataPoint = allDataPoints.get(timestamp)
                      dataPoint[crypto.symbol] = point.price_usd
                    })
                  })
                  
                  return Array.from(allDataPoints.values()).sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                })()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number, name: string) => [
                      `$${value.toLocaleString()}`, name
                    ]}
                  />
                  <Legend />
                  {priceHistory.price_history.map((crypto: any, index: number) => (
                    <Line 
                      key={crypto.symbol}
                      type="monotone" 
                      dataKey={crypto.symbol} 
                      stroke={['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][index % 5]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  )
}

// Configuration for the generic page
const cryptoHoldingsConfig: GenericAssetPageConfig<CryptoHolding> = {
  // API configuration
  fetchAll: cryptoHoldingsApi.getAll,
  create: cryptoHoldingsApi.create,
  update: cryptoHoldingsApi.update,
  delete: cryptoHoldingsApi.delete,
  fetchSchema: () => pluginsApi.getSchema('crypto_holdings'),
  transformData: transformCryptoData,
  
  // Page configuration
  title: 'Crypto Holdings',
  description: 'Track your cryptocurrency investments across exchanges and wallets',
  icon: Coins,
  entityName: 'Crypto Holding',
  
  // Rendering configuration
  renderCard: CryptoCard,
  renderSummaryCards: CryptoSummaryCards,
  renderCharts: CryptoCharts,
  renderCustomView: (viewMode: string, holdings: CryptoHolding[]) => {
    if (viewMode === 'history') {
      return CryptoHistory(holdings)
    }
    return null
  },
  
  // Feature configuration
  supportedViewModes: ['grid', 'list', 'charts', 'history'],
  enableAdd: true,
  enableRefresh: true,
  
  // Modal configuration
  entryType: 'crypto_holdings',
  getFormData: (holding) => ({
    institution_name: holding.institution_name,
    crypto_symbol: holding.crypto_symbol,
    balance_tokens: holding.balance_tokens,
    purchase_price_usd: holding.purchase_price_usd || null,
    purchase_date: holding.purchase_date || '',
    wallet_address: holding.wallet_address || '',
    notes: holding.notes || ''
  })
}

function CryptoHoldings() {
  return <GenericAssetPage config={cryptoHoldingsConfig} />
}

export default CryptoHoldings