import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Building, PieChart, RefreshCw, Clock, AlertTriangle, Wallet, Coins } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'
import { netWorthApi, pricesApi } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import type { NetWorthSummary } from '@/types'
import MarketStatus from '@/components/MarketStatus'

// Generate realistic trend data based on current net worth
const generateTrendData = (currentNetWorth: number) => {
  const months = []
  const now = new Date()
  
  // Generate last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthName = date.toLocaleDateString('en-US', { month: 'short' })
    months.push(monthName)
  }
  
  // Create progressive values showing upward trend
  // Start 20% lower 6 months ago, gradually increase to current value
  const startValue = currentNetWorth * 0.8
  const valueIncrement = (currentNetWorth - startValue) / 5
  
  return months.map((month, index) => ({
    month,
    value: Math.round(startValue + (valueIncrement * index))
  }))
}

// Generate real asset allocation data based on current net worth
const generateAllocationData = (netWorth: NetWorthSummary | null) => {
  if (!netWorth || netWorth.total_assets === 0) {
    return [
      { name: 'No Data', value: 100, amount: 0, color: '#9ca3af' }
    ]
  }

  const totalAssets = netWorth.total_assets
  const stockValue = netWorth.stock_holdings_value || 0
  const equityValue = netWorth.vested_equity_value || 0
  const realEstateValue = netWorth.real_estate_equity || 0
  const cashHoldingsValue = netWorth.cash_holdings_value || 0
  const cryptoHoldingsValue = netWorth.crypto_holdings_value || 0
  
  // Calculate other assets as remaining assets (after separating all known asset types)
  const otherValue = Math.max(0, totalAssets - stockValue - equityValue - realEstateValue - cashHoldingsValue - cryptoHoldingsValue)
  
  const allocation = [
    {
      name: 'Direct Stocks',
      value: stockValue,
      color: '#3b82f6',
      percentage: totalAssets > 0 ? Math.round((stockValue / totalAssets) * 100) : 0
    },
    {
      name: 'Equity Comp',
      value: equityValue,
      color: '#8b5cf6',
      percentage: totalAssets > 0 ? Math.round((equityValue / totalAssets) * 100) : 0
    },
    {
      name: 'Real Estate',
      value: realEstateValue,
      color: '#10b981',
      percentage: totalAssets > 0 ? Math.round((realEstateValue / totalAssets) * 100) : 0
    },
    {
      name: 'Cash Holdings',
      value: cashHoldingsValue,
      color: '#22c55e',
      percentage: totalAssets > 0 ? Math.round((cashHoldingsValue / totalAssets) * 100) : 0
    },
    {
      name: 'Crypto',
      value: cryptoHoldingsValue,
      color: '#f97316',
      percentage: totalAssets > 0 ? Math.round((cryptoHoldingsValue / totalAssets) * 100) : 0
    },
    {
      name: 'Other',
      value: otherValue,
      color: '#f59e0b',
      percentage: totalAssets > 0 ? Math.round((otherValue / totalAssets) * 100) : 0
    }
  ]

  // Filter out zero-value categories and ensure we have data to show
  const validCategories = allocation.filter(item => item.value > 0)
  
  if (validCategories.length === 0) {
    return [{ name: 'No Data', value: 100, amount: 0, color: '#9ca3af' }]
  }

  // Recalculate percentages to ensure they add up to 100%
  const totalValidValue = validCategories.reduce((sum, item) => sum + item.value, 0)
  let runningTotal = 0
  const result = validCategories.map((item, index) => {
    let percentage
    if (index === validCategories.length - 1) {
      // Last item gets remaining percentage to ensure total is 100%
      percentage = 100 - runningTotal
    } else {
      percentage = Math.round((item.value / totalValidValue) * 100)
      runningTotal += percentage
    }
    
    return {
      name: item.name,
      value: percentage,
      amount: item.value, // Preserve original dollar amount for tooltips
      color: item.color
    }
  })

  return result
}

// Format currency for tooltips
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function MetricCard({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  prefix = '$' 
}: {
  title: string
  value: number | string
  change?: number
  changeType?: 'positive' | 'negative'
  icon: any
  prefix?: string
}) {
  return (
    <div className="metric-card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change && (
            <div className={`flex items-center mt-1 ${
              changeType === 'positive' ? 'text-success-600' : 'text-danger-600'
            }`}>
              {changeType === 'positive' ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span className="text-sm font-medium">
                {Math.abs(change)}% from last month
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-primary-50 dark:bg-primary-900 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [priceStatus, setPriceStatus] = useState<any>(null)
  const { isDarkMode } = useTheme() // Still needed for chart dynamic styling

  const fetchNetWorth = async () => {
    try {
      const data = await netWorthApi.getSummary()
      setNetWorth(data)
    } catch (error) {
      console.error('Failed to fetch net worth:', error)
      // Use mock data for now
      setNetWorth({
        net_worth: 270000,
        total_assets: 320000,
        total_liabilities: 50000,
        vested_equity_value: 75000,
        unvested_equity_value: 25000,
        stock_holdings_value: 100000,
        real_estate_equity: 125000,
        cash_holdings_value: 25000,
        crypto_holdings_value: 20000,
        last_updated: new Date().toISOString(),
      })
    }
  }

  const fetchPriceStatus = async () => {
    try {
      const status = await pricesApi.getStatus()
      setPriceStatus(status)
    } catch (error) {
      console.error('Failed to fetch price status:', error)
    }
  }

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true)
    try {
      await pricesApi.refreshAll(true) // Force refresh to bypass cache and market hours
      await fetchNetWorth() // Refresh net worth after price update
      await fetchPriceStatus() // Update price status
    } catch (error) {
      console.error('Failed to refresh prices:', error)
    } finally {
      setRefreshingPrices(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchNetWorth(), fetchPriceStatus()])
      setLoading(false)
    }
    
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Generate trend data based on current net worth
  const trendData = generateTrendData(netWorth?.net_worth || 0)
  
  // Generate allocation data based on actual asset values
  const allocationData = generateAllocationData(netWorth)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Your complete financial overview
          </p>
          <div className="mt-3">
            <MarketStatus showDetails={true} />
          </div>
        </div>
        
        {/* Price Status and Refresh */}
        <div className="flex items-center space-x-4">
          {priceStatus && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1">
                {priceStatus.stale_count > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Clock className="w-4 h-4 text-green-500" />
                )}
                <span className="text-gray-600 dark:text-gray-400">
                  {priceStatus.stale_count > 0 
                    ? `${priceStatus.stale_count} stale prices`
                    : 'Prices up to date'
                  }
                </span>
              </div>
              <span className="text-gray-500 dark:text-gray-500">•</span>
              <span className="text-gray-500 dark:text-gray-500 text-xs">
                {priceStatus.provider_name}
              </span>
            </div>
          )}
          
          <button
            onClick={handleRefreshPrices}
            disabled={refreshingPrices}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshingPrices ? 'animate-spin' : ''}`} />
            {refreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
          </button>
        </div>
      </div>

      {/* Net Worth Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-lg font-medium">Total Net Worth</p>
            <p className="text-4xl font-bold mt-2">
              ${(netWorth?.net_worth || 0).toLocaleString()}
            </p>
            <div className="flex items-center mt-3 text-blue-100">
              <TrendingUp className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">+0% from last month</span>
            </div>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-full">
            <DollarSign className="w-12 h-12" />
          </div>
        </div>
      </div>

      {/* Financial Metrics Summary */}
      <div className="space-y-6">
        {/* First Row - Primary Assets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Assets"
            value={netWorth?.total_assets || 0}
            change={0}
            changeType="positive"
            icon={TrendingUp}
          />
          <MetricCard
            title="Vested Equity"
            value={netWorth?.vested_equity_value || 0}
            change={0}
            changeType="positive"
            icon={Briefcase}
          />
          <MetricCard
            title="Real Estate Equity"
            value={netWorth?.real_estate_equity || 0}
            change={0}
            changeType="positive"
            icon={Building}
          />
          <MetricCard
            title="Future Value"
            value={netWorth?.unvested_equity_value || 0}
            icon={PieChart}
            prefix="$"
          />
        </div>

        {/* Second Row - Liquid Assets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            title="Total Cash"
            value={netWorth?.cash_holdings_value || 0}
            change={0}
            changeType="positive"
            icon={Wallet}
          />
          <MetricCard
            title="Crypto Holdings"
            value={netWorth?.crypto_holdings_value || 0}
            change={0}
            changeType="positive"
            icon={Coins}
          />
          <MetricCard
            title="Stock Holdings"
            value={netWorth?.stock_holdings_value || 0}
            change={0}
            changeType="positive"
            icon={TrendingUp}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Trend */}
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Net Worth Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                  axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                  axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    color: isDarkMode ? '#ffffff' : '#000000'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Asset Allocation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value}% (${formatCurrency(props.payload.amount)})`, 
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    color: `${isDarkMode ? '#ffffff' : '#000000'} !important`
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {allocationData.map((item) => (
              <div key={item.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {item.name} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn-primary flex items-center justify-center">
            <DollarSign className="w-4 h-4 mr-2" />
            Add Stock Holding
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <Briefcase className="w-4 h-4 mr-2" />
            Update Equity
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <Building className="w-4 h-4 mr-2" />
            Update Property
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <PieChart className="w-4 h-4 mr-2" />
            View Analytics
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900 dark:text-gray-200">Updated AAPL stock holding</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900 dark:text-gray-200">Added new equity grant</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">1 day ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-warning-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900 dark:text-gray-200">Property value updated</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">3 days ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard