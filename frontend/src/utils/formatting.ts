/**
 * Shared formatting utilities to eliminate duplication across components
 */

/**
 * Format currency values consistently across the application
 */
export const formatCurrency = (amount: number, options?: {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  currency?: string
}): string => {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
    currency = 'USD'
  } = options || {}

  // Handle BTC as a special case since it's not a valid ISO currency code
  if (currency.toUpperCase() === 'BTC') {
    return `₿${formatNumber(amount, { 
      minimumFractionDigits: minimumFractionDigits || 8, 
      maximumFractionDigits: maximumFractionDigits || 8 
    })}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount)
}

/**
 * Format numbers with locale-specific thousand separators
 */
export const formatNumber = (num: number, options?: {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}): string => {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = options || {}

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num)
}

/**
 * Format date strings consistently across the application
 */
export const formatDate = (dateString: string | Date, options?: {
  includeTime?: boolean
  dateStyle?: 'full' | 'long' | 'medium' | 'short'
  timeStyle?: 'full' | 'long' | 'medium' | 'short'
}): string => {
  const {
    includeTime = false,
    dateStyle = 'medium'
  } = options || {}

  const date = typeof dateString === 'string' ? new Date(dateString) : dateString

  if (includeTime) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return date.toLocaleDateString('en-US', {
    dateStyle
  })
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) {
    return 'just now'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`
  } else if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`
  } else {
    return formatDate(date)
  }
}

/**
 * Format percentage values
 */
export const formatPercentage = (value: number, options?: {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}): string => {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 1
  } = options || {}

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value / 100)
}

/**
 * Format large numbers with K/M/B suffixes
 */
export const formatCompactNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(num)
}

/**
 * Format crypto amounts with appropriate decimal places
 */
export const formatCrypto = (amount: number, symbol: string): string => {
  // Bitcoin and similar high-value coins - up to 8 decimal places
  if (['BTC', 'ETH'].includes(symbol.toUpperCase())) {
    return `${formatNumber(amount, { maximumFractionDigits: 8 })} ${symbol.toUpperCase()}`
  }
  
  // Most other cryptos - up to 4 decimal places
  return `${formatNumber(amount, { maximumFractionDigits: 4 })} ${symbol.toUpperCase()}`
}

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format file sizes
 */
export const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 Bytes'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}