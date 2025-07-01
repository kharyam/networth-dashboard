import { useState, useEffect } from 'react'
import { RefreshCw, Clock, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus, X, CheckCircle, XCircle, Info } from 'lucide-react'
import { pricesApi } from '@/services/api'

interface PriceStatus {
  last_updated: string
  stale_count: number
  total_count: number
  provider_name: string
  cache_stale: boolean
  force_refresh_needed: boolean
  last_cache_update?: string
  cache_age_minutes: number
  market_open: boolean
}

interface PriceUpdateResult {
  symbol: string
  old_price: number
  new_price: number
  updated: boolean
  error?: string
  error_type?: string
  timestamp: string
  source: string
  price_change: number
  price_change_pct: number
  cache_age?: string
}

interface PriceRefreshSummary {
  total_symbols: number
  updated_symbols: number
  failed_symbols: number
  results: PriceUpdateResult[]
  provider_name: string
  timestamp: string
  duration_ms: number
}

interface PriceRefreshControlsProps {
  onRefreshComplete?: () => Promise<void>
  showDetails?: boolean
  className?: string
}

export default function PriceRefreshControls({ 
  onRefreshComplete, 
  showDetails = true,
  className = "" 
}: PriceRefreshControlsProps) {
  const [priceStatus, setPriceStatus] = useState<PriceStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [forceRefreshing, setForceRefreshing] = useState(false)
  const [lastRefreshResult, setLastRefreshResult] = useState<PriceRefreshSummary | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [isDataReloading, setIsDataReloading] = useState(false)

  const fetchPriceStatus = async () => {
    try {
      const status = await pricesApi.getStatus()
      setPriceStatus(status)
    } catch (error) {
      console.error('Failed to fetch price status:', error)
    }
  }

  useEffect(() => {
    fetchPriceStatus()
  }, [])

  const handleSmartRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await pricesApi.autoRefresh() // Uses smart cache logic
      console.log('Price refresh result:', result) // Debug log
      console.log('Result type:', typeof result, 'Has results:', !!result?.results)
      
      if (result && typeof result === 'object') {
        setLastRefreshResult(result)
        setShowResults(true)
      } else {
        console.error('Invalid API response structure:', result)
      }
      
      await fetchPriceStatus() // Update status
      if (onRefreshComplete) {
        // Delay the data reload and show loading state in modal
        setTimeout(async () => {
          setIsDataReloading(true)
          try {
            await onRefreshComplete()
          } finally {
            setIsDataReloading(false)
            // Don't auto-close the modal - leave it for user to manually close
          }
        }, 2000) // 2 second delay to allow user to review results first
      }
    } catch (error) {
      console.error('Failed to refresh prices:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleForceRefresh = async () => {
    setForceRefreshing(true)
    try {
      const result = await pricesApi.forceRefresh() // Bypasses cache
      console.log('Force refresh result:', result) // Debug log
      console.log('Force result type:', typeof result, 'Has results:', !!result?.results)
      
      if (result && typeof result === 'object') {
        setLastRefreshResult(result)
        setShowResults(true)
      } else {
        console.error('Invalid force refresh API response structure:', result)
      }
      
      await fetchPriceStatus() // Update status
      if (onRefreshComplete) {
        // Delay the data reload and show loading state in modal
        setTimeout(async () => {
          setIsDataReloading(true)
          try {
            await onRefreshComplete()
          } finally {
            setIsDataReloading(false)
            // Don't auto-close the modal - leave it for user to manually close
          }
        }, 2000) // 2 second delay to allow user to review results first
      }
    } catch (error) {
      console.error('Failed to force refresh prices:', error)
    } finally {
      setForceRefreshing(false)
    }
  }

  const formatCacheAge = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m ago`
    } else if (minutes < 1440) { // Less than 24 hours
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m ago`
    } else {
      const days = Math.floor(minutes / 1440)
      return `${days}d ago`
    }
  }

  const getCacheStatusColor = (): string => {
    if (!priceStatus) return 'text-gray-500'
    if (priceStatus.force_refresh_needed) return 'text-red-500'
    if (priceStatus.cache_stale) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getCacheStatusIcon = () => {
    if (!priceStatus) return <Clock className="w-4 h-4" />
    if (priceStatus.force_refresh_needed) return <AlertTriangle className="w-4 h-4" />
    if (priceStatus.cache_stale) return <AlertTriangle className="w-4 h-4" />
    return <Clock className="w-4 h-4" />
  }

  const getCacheStatusText = (): string => {
    if (!priceStatus) return 'Loading status...'
    
    if (priceStatus.stale_count > 0) {
      return `${priceStatus.stale_count} prices missing`
    }
    
    if (priceStatus.force_refresh_needed) {
      return `Cache very stale (${formatCacheAge(priceStatus.cache_age_minutes)})`
    }
    
    if (priceStatus.cache_stale) {
      return `Cache stale (${formatCacheAge(priceStatus.cache_age_minutes)})`
    }
    
    return `Updated ${formatCacheAge(priceStatus.cache_age_minutes)}`
  }

  const formatPriceChange = (change: number, changePercent: number) => {
    const isPositive = change > 0
    const isNegative = change < 0
    const changeIcon = isPositive ? <TrendingUp className="w-4 h-4" /> : 
                      isNegative ? <TrendingDown className="w-4 h-4" /> : 
                      <Minus className="w-4 h-4" />
    const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 
                       isNegative ? 'text-red-600 dark:text-red-400' : 
                       'text-gray-600 dark:text-gray-400'
    
    return (
      <div className={`flex items-center space-x-1 ${changeColor}`}>
        {changeIcon}
        <span className="font-medium">
          ${Math.abs(change).toFixed(2)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
        </span>
      </div>
    )
  }

  return (
    <>
      <div className={`flex items-center space-x-4 ${className}`}>
        {/* Price Status Display */}
        {showDetails && priceStatus && (
          <div className="flex items-center space-x-2 text-sm">
            <div className={`flex items-center space-x-1 ${getCacheStatusColor()}`}>
              {getCacheStatusIcon()}
              <span className="text-gray-600 dark:text-gray-400">
                {getCacheStatusText()}
              </span>
            </div>
            
            {priceStatus.market_open && (
              <>
                <span className="text-gray-500 dark:text-gray-500">•</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-600 dark:text-green-400 text-xs">Market Open</span>
                </div>
              </>
            )}
            
            <span className="text-gray-500 dark:text-gray-500">•</span>
            <span className="text-gray-500 dark:text-gray-500 text-xs">
              {priceStatus.provider_name}
            </span>
          </div>
        )}

        {/* Refresh Buttons */}
        <div className="flex items-center space-x-2">
          {/* Smart Refresh Button (Primary) */}
          <button
            onClick={handleSmartRefresh}
            disabled={refreshing || forceRefreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            title="Smart refresh - respects cache and market hours"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Prices'}
          </button>

          {/* Force Refresh Button (Always show for debugging) */}
          <button
            onClick={handleForceRefresh}
            disabled={refreshing || forceRefreshing}
            className="inline-flex items-center px-3 py-2 border border-orange-300 dark:border-orange-600 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
            title="Force refresh - bypasses all cache completely"
          >
            <Zap className={`w-4 h-4 mr-2 ${forceRefreshing ? 'animate-spin' : ''}`} />
            {forceRefreshing ? 'Force Refreshing...' : 'Force Refresh'}
          </button>
          
          {/* Conditional Force Refresh Button (Original logic for later) */}
          {false && priceStatus?.force_refresh_needed && (
            <button
              onClick={handleForceRefresh}
              disabled={refreshing || forceRefreshing}
              className="inline-flex items-center px-3 py-2 border border-orange-300 dark:border-orange-600 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
              title="Force refresh - bypasses cache completely"
            >
              <Zap className={`w-4 h-4 mr-2 ${forceRefreshing ? 'animate-spin' : ''}`} />
              {forceRefreshing ? 'Force Refreshing...' : 'Force Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Refresh Results Modal */}
      {showResults && lastRefreshResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Price Refresh Results
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Completed in {lastRefreshResult.duration_ms}ms • {lastRefreshResult.provider_name}
                    {isDataReloading && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400">
                        • Refreshing page data...
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setShowResults(false)}
                  disabled={isDataReloading}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
                  title={isDataReloading ? "Please wait while data is refreshing..." : "Close results"}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Summary Stats */}
              <div className="flex items-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {lastRefreshResult.updated_symbols} Updated
                  </span>
                </div>
                {lastRefreshResult.failed_symbols > 0 && (
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {lastRefreshResult.failed_symbols} Failed
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {(lastRefreshResult.results || []).filter(r => r.updated && r.source === 'api').length} from API, {(lastRefreshResult.results || []).filter(r => r.updated && r.source === 'cache').length} from cache
                  </span>
                </div>
              </div>
            </div>

            {/* Results Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!lastRefreshResult.results ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    No detailed results available. The refresh operation completed successfully.
                  </p>
                </div>
              ) : (
                <>
              {/* Successful Updates */}
              {(lastRefreshResult.results || []).filter(r => r.updated).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Successfully Updated Prices
                  </h4>
                  <div className="space-y-3">
                    {(lastRefreshResult.results || []).filter(r => r.updated).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {result.symbol}
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            result.source === 'api' 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                          }`}>
                            {result.source === 'api' ? 'API' : 'Cache'}
                          </div>
                          {result.cache_age && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Cache: {result.cache_age}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            ${result.old_price.toFixed(2)} → ${result.new_price.toFixed(2)}
                          </div>
                          {result.price_change !== 0 && formatPriceChange(result.price_change, result.price_change_pct)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Updates */}
              {(lastRefreshResult.results || []).filter(r => !r.updated).length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                    Failed Updates
                  </h4>
                  <div className="space-y-3">
                    {(lastRefreshResult.results || []).filter(r => !r.updated).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {result.symbol}
                          </div>
                          {result.error_type && (
                            <div className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              {result.error_type.replace('_', ' ')}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-400 max-w-md truncate">
                          {result.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {isDataReloading ? (
                    <span className="flex items-center">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                      Updating stock prices in portfolio data...
                    </span>
                  ) : (
                    "Results shown above. Stock portfolio will be updated automatically."
                  )}
                </div>
                <button
                  onClick={() => setShowResults(false)}
                  disabled={isDataReloading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isDataReloading ? 'Please Wait...' : 'Close Results'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}