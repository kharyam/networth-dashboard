import { useMemo } from 'react'
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts'
import { RealEstate } from '../types'
import { useTheme } from '@/contexts/ThemeContext'

interface PropertyChartsProps {
  properties: RealEstate[]
}

function PropertyCharts({ properties }: PropertyChartsProps) {
  const { isDarkMode } = useTheme()

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalValue = properties.reduce((sum, p) => sum + p.current_value, 0)
    const totalEquity = properties.reduce((sum, p) => sum + (p.current_value - (p.outstanding_mortgage || 0)), 0)
    const totalMortgage = properties.reduce((sum, p) => sum + (p.outstanding_mortgage || 0), 0)
    const totalPurchasePrice = properties.reduce((sum, p) => sum + (p.purchase_price || 0), 0)
    const totalAppreciation = totalValue - totalPurchasePrice

    return {
      totalValue,
      totalEquity,
      totalMortgage,
      totalPurchasePrice,
      totalAppreciation,
      appreciationPercentage: totalPurchasePrice > 0 ? (totalAppreciation / totalPurchasePrice) * 100 : 0,
      equityPercentage: totalValue > 0 ? (totalEquity / totalValue) * 100 : 0
    }
  }, [properties])

  // Equity vs Debt breakdown
  const equityDebtData = useMemo(() => {
    if (portfolioMetrics.totalValue === 0) return []

    return [
      {
        name: 'Equity',
        value: Math.round((portfolioMetrics.totalEquity / portfolioMetrics.totalValue) * 100),
        amount: portfolioMetrics.totalEquity,
        color: '#10b981'
      },
      {
        name: 'Mortgage Debt',
        value: Math.round((portfolioMetrics.totalMortgage / portfolioMetrics.totalValue) * 100),
        amount: portfolioMetrics.totalMortgage,
        color: '#f59e0b'
      }
    ].filter(item => item.value > 0)
  }, [portfolioMetrics])

  // Property type distribution
  const propertyTypeData = useMemo(() => {
    const typeBreakdown = properties.reduce((acc, property) => {
      const type = property.property_type || 'other'
      if (!acc[type]) {
        acc[type] = { count: 0, value: 0 }
      }
      acc[type].count++
      acc[type].value += property.current_value
      return acc
    }, {} as Record<string, { count: number; value: number }>)

    const colors = {
      primary_residence: '#3b82f6',
      investment_property: '#8b5cf6',
      vacation_home: '#10b981',
      commercial: '#f59e0b',
      land: '#ef4444',
      other: '#6b7280'
    }

    const typeLabels = {
      primary_residence: 'Primary Residence',
      investment_property: 'Investment Property',
      vacation_home: 'Vacation Home',
      commercial: 'Commercial',
      land: 'Land/Lot',
      other: 'Other'
    }

    return Object.entries(typeBreakdown).map(([type, data]) => ({
      name: typeLabels[type as keyof typeof typeLabels] || type,
      value: Math.round((data.value / portfolioMetrics.totalValue) * 100),
      count: data.count,
      amount: data.value,
      color: colors[type as keyof typeof colors] || colors.other
    })).filter(item => item.value > 0)
  }, [properties, portfolioMetrics.totalValue])

  // Individual property performance
  const propertyPerformanceData = useMemo(() => {
    return properties.map(property => {
      const equity = property.current_value - (property.outstanding_mortgage || 0)
      const appreciation = property.purchase_price 
        ? property.current_value - property.purchase_price 
        : 0
      const appreciationPercentage = property.purchase_price && property.purchase_price > 0
        ? (appreciation / property.purchase_price) * 100
        : 0

      return {
        name: property.property_name?.split(',')[0] || `Property ${property.id}`,
        currentValue: property.current_value,
        purchasePrice: property.purchase_price || 0,
        equity: equity,
        appreciation: appreciation,
        appreciationPercentage: appreciationPercentage
      }
    }).filter(p => p.currentValue > 0)
  }, [properties])

  // Format currency for tooltips
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No properties to analyze</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Add your first property to see portfolio analytics
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Portfolio Value</h4>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(portfolioMetrics.totalValue)}
          </p>
        </div>
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Equity</h4>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(portfolioMetrics.totalEquity)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {portfolioMetrics.equityPercentage.toFixed(1)}% of portfolio
          </p>
        </div>
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Appreciation</h4>
          <p className={`text-2xl font-bold ${
            portfolioMetrics.totalAppreciation >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(portfolioMetrics.totalAppreciation)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {portfolioMetrics.appreciationPercentage > 0 ? '+' : ''}
            {portfolioMetrics.appreciationPercentage.toFixed(1)}% growth
          </p>
        </div>
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Properties</h4>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {properties.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatCurrency(portfolioMetrics.totalValue / properties.length)} avg value
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity vs Debt Chart */}
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Portfolio Equity vs Debt
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={equityDebtData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {equityDebtData.map((entry, index) => (
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
                    color: isDarkMode ? '#ffffff' : '#000000'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {equityDebtData.map((item) => (
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

        {/* Property Type Distribution */}
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Property Type Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={propertyTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {propertyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value}% (${props.payload.count} properties)`, 
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                    border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    color: isDarkMode ? '#ffffff' : '#000000'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-1">
            {propertyTypeData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {item.count} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Property Performance Comparison */}
        {propertyPerformanceData.length > 0 && (
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Property Performance Comparison
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={propertyPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    tick={{ fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                    axisLine={{ stroke: isDarkMode ? '#374151' : '#e5e7eb' }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels = {
                        currentValue: 'Current Value',
                        purchasePrice: 'Purchase Price',
                        equity: 'Equity'
                      }
                      return [formatCurrency(value), labels[name as keyof typeof labels] || name]
                    }}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: isDarkMode ? '#ffffff' : '#000000'
                    }}
                  />
                  <Bar dataKey="purchasePrice" fill="#94a3b8" name="purchasePrice" />
                  <Bar dataKey="currentValue" fill="#3b82f6" name="currentValue" />
                  <Bar dataKey="equity" fill="#10b981" name="equity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PropertyCharts