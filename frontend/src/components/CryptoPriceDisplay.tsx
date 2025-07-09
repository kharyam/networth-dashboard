import React from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

interface CryptoPrice {
  symbol: string
  name: string
  price_usd: number
  price_btc: number
  percent_change_24h: number
  last_updated: string
}

interface CryptoPriceDisplayProps {
  holdings: Array<{
    crypto_symbol: string
    current_price_usd?: number
    current_price_btc?: number
    price_change_24h?: number
    price_last_updated?: string
  }>
  priceMode: 'usd' | 'btc'
  onRefreshPrices?: () => Promise<void>
  loading?: boolean
}

const CryptoPriceDisplay: React.FC<CryptoPriceDisplayProps> = ({
  holdings,
  priceMode,
  onRefreshPrices,
  loading = false
}) => {
  // Extract unique crypto symbols and their price data
  const uniqueCryptos = holdings.reduce((acc, holding) => {
    const symbol = holding.crypto_symbol.toLowerCase()
    if (!acc[symbol]) {
      acc[symbol] = {
        symbol: holding.crypto_symbol.toUpperCase(),
        name: holding.crypto_symbol.toUpperCase(), // Use symbol as name since crypto_name isn't available
        price_usd: holding.current_price_usd || 0,
        price_btc: holding.current_price_btc || 0,
        percent_change_24h: holding.price_change_24h || 0,
        last_updated: holding.price_last_updated || ''
      }
    }
    return acc
  }, {} as Record<string, CryptoPrice>)

  const cryptoList = Object.values(uniqueCryptos)

  if (cryptoList.length === 0) {
    return null
  }

  const formatPrice = (price: number, mode: 'usd' | 'btc') => {
    if (mode === 'usd') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: price < 1 ? 4 : 2,
        maximumFractionDigits: price < 1 ? 6 : 2
      }).format(price)
    } else {
      return `₿${price.toFixed(8)}`
    }
  }

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-500" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400'
    if (change < 0) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Current Crypto Prices
        </h3>
        {onRefreshPrices && (
          <button
            onClick={onRefreshPrices}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cryptoList.map((crypto) => (
          <div
            key={crypto.symbol}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {crypto.symbol}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {crypto.name}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(crypto.percent_change_24h)}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatPrice(
                  priceMode === 'usd' ? crypto.price_usd : crypto.price_btc,
                  priceMode
                )}
              </div>
              
              <div className={`text-sm font-medium ${getTrendColor(crypto.percent_change_24h)}`}>
                {crypto.percent_change_24h > 0 ? '+' : ''}
                {crypto.percent_change_24h.toFixed(2)}% (24h)
              </div>
              
              {crypto.last_updated && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Updated: {new Date(crypto.last_updated).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {cryptoList.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No crypto price data available
        </div>
      )}
    </div>
  )
}

export default CryptoPriceDisplay