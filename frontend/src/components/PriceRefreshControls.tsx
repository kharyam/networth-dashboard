import { useState, useEffect } from 'react'
import { RefreshCw, Clock, AlertTriangle, Zap } from 'lucide-react'
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
      await pricesApi.autoRefresh() // Uses smart cache logic
      await fetchPriceStatus() // Update status
      if (onRefreshComplete) {
        await onRefreshComplete()
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
      await pricesApi.forceRefresh() // Bypasses cache
      await fetchPriceStatus() // Update status
      if (onRefreshComplete) {
        await onRefreshComplete()
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

  return (
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

        {/* Force Refresh Button (Secondary - only show when needed) */}
        {priceStatus?.force_refresh_needed && (
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
  )
}