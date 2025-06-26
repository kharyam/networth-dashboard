import { useState, useEffect } from 'react'
import { Clock, TrendingUp, TrendingDown } from 'lucide-react'

interface MarketStatus {
  is_open: boolean
  open_time: string
  close_time: string
  next_open: string
  next_close: string
  time_to_next: string
  status: 'open' | 'closed' | 'pre_market' | 'after_hours'
}

interface MarketStatusProps {
  className?: string
  showDetails?: boolean
}

export default function MarketStatus({ className = '', showDetails = false }: MarketStatusProps) {
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMarketStatus()
    
    // Refresh market status every minute
    const interval = setInterval(fetchMarketStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchMarketStatus = async () => {
    try {
      const response = await fetch('/api/v1/market/status')
      if (!response.ok) {
        throw new Error('Failed to fetch market status')
      }
      const data = await response.json()
      setMarketStatus(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch market status:', err)
      setError('Failed to load market status')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-green-600 dark:text-green-400'
      case 'closed':
        return 'text-red-600 dark:text-red-400'
      case 'pre_market':
      case 'after_hours':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <TrendingUp className="h-4 w-4" />
      case 'closed':
        return <TrendingDown className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Market Open'
      case 'closed':
        return 'Market Closed'
      case 'pre_market':
        return 'Pre-Market'
      case 'after_hours':
        return 'After Hours'
      default:
        return 'Unknown'
    }
  }

  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr)
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    } catch {
      return timeStr
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Clock className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  if (error || !marketStatus) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Clock className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Market status unavailable</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col space-y-1 ${className}`}>
      {/* Main Status */}
      <div className="flex items-center space-x-2">
        <div className={getStatusColor(marketStatus.status)}>
          {getStatusIcon(marketStatus.status)}
        </div>
        <span className={`text-sm font-medium ${getStatusColor(marketStatus.status)}`}>
          {getStatusText(marketStatus.status)}
        </span>
        {marketStatus.time_to_next && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({marketStatus.time_to_next})
          </span>
        )}
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <div>
            Open: {formatTime(marketStatus.open_time)} - Close: {formatTime(marketStatus.close_time)}
          </div>
          {marketStatus.status === 'open' && (
            <div>Market closes in {marketStatus.time_to_next}</div>
          )}
          {marketStatus.status !== 'open' && (
            <div>Next open: {formatTime(marketStatus.next_open)}</div>
          )}
        </div>
      )}
    </div>
  )
}