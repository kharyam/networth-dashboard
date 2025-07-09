import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, PiggyBank, Building, Briefcase, Coins } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { netWorthApi } from '@/services/api'
import { useTheme } from '@/contexts/ThemeContext'
import type { PassiveIncomeData } from '@/types'

// Color scheme for different income sources
const INCOME_COLORS = {
  'Cash Interest': '#22c55e',
  'Stock Dividends': '#3b82f6', 
  'Real Estate': '#10b981',
  'Crypto Staking': '#f97316'
}

// Format currency for display
const formatCurrency = (amount: number, decimals: number = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

function IncomeMetric({ 
  title, 
  monthly, 
  annual, 
  icon: Icon, 
  color 
}: {
  title: string
  monthly: number
  annual: number
  icon: any
  color: string
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <div 
              className="p-2 rounded-lg mr-3"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h4>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(monthly)}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">/mo</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formatCurrency(annual)} annually
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PassiveIncomeSection() {
  const [passiveIncome, setPassiveIncome] = useState<PassiveIncomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isDarkMode } = useTheme()

  const fetchPassiveIncome = async () => {
    try {
      setError(null)
      const data = await netWorthApi.getPassiveIncome()
      setPassiveIncome(data)
    } catch (error) {
      console.error('Failed to fetch passive income:', error)
      setError('Failed to load passive income data')
      // Set mock data for development
      setPassiveIncome({
        total_monthly_income: 1000,
        total_annual_income: 12000,
        income_breakdown: [
          {
            source: 'Cash Interest',
            monthly_amount: 200,
            annual_amount: 2400,
            percentage: 20.0
          },
          {
            source: 'Stock Dividends', 
            monthly_amount: 450,
            annual_amount: 5400,
            percentage: 45.0
          },
          {
            source: 'Real Estate',
            monthly_amount: 200,
            annual_amount: 2400,
            percentage: 20.0
          },
          {
            source: 'Crypto Staking',
            monthly_amount: 150,
            annual_amount: 1800,
            percentage: 15.0
          }
        ],
        summary: {
          cash_interest_monthly: 200,
          stock_dividends_monthly: 450,
          real_estate_income_monthly: 200,
          crypto_staking_monthly: 150
        },
        last_updated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPassiveIncome()
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    )
  }

  if (error || !passiveIncome) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">{error || 'No passive income data available'}</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const chartData = passiveIncome.income_breakdown.map(item => ({
    name: item.source,
    value: item.percentage,
    amount: item.monthly_amount,
    color: INCOME_COLORS[item.source as keyof typeof INCOME_COLORS] || '#9ca3af'
  }))

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Passive Income</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Monthly recurring income from investments
          </p>
        </div>
        <div className="p-3 bg-success-50 dark:bg-success-900 rounded-lg">
          <PiggyBank className="w-6 h-6 text-success-600 dark:text-success-400" />
        </div>
      </div>

      {/* Total Monthly Income Hero */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium">Total Monthly Passive Income</p>
            <p className="text-3xl font-bold mt-1">
              {formatCurrency(passiveIncome.total_monthly_income)}
            </p>
            <p className="text-green-100 text-sm mt-2">
              {formatCurrency(passiveIncome.total_annual_income)} annually
            </p>
          </div>
          <div className="p-3 bg-white bg-opacity-20 rounded-full">
            <TrendingUp className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Income Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <IncomeMetric
          title="Cash Interest"
          monthly={passiveIncome.summary.cash_interest_monthly}
          annual={passiveIncome.summary.cash_interest_monthly * 12}
          icon={DollarSign}
          color={INCOME_COLORS['Cash Interest']}
        />
        <IncomeMetric
          title="Stock Dividends"
          monthly={passiveIncome.summary.stock_dividends_monthly}
          annual={passiveIncome.summary.stock_dividends_monthly * 12}
          icon={Briefcase}
          color={INCOME_COLORS['Stock Dividends']}
        />
        <IncomeMetric
          title="Real Estate"
          monthly={passiveIncome.summary.real_estate_income_monthly}
          annual={passiveIncome.summary.real_estate_income_monthly * 12}
          icon={Building}
          color={INCOME_COLORS['Real Estate']}
        />
        <IncomeMetric
          title="Crypto Staking"
          monthly={passiveIncome.summary.crypto_staking_monthly}
          annual={passiveIncome.summary.crypto_staking_monthly * 12}
          icon={Coins}
          color={INCOME_COLORS['Crypto Staking']}
        />
      </div>

      {/* Income Distribution Chart */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Income Distribution</h4>
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Pie Chart */}
          <div className="h-48 w-full lg:w-64 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)}% (${formatCurrency(props.payload.amount)}/mo)`, 
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

          {/* Legend */}
          <div className="flex-1 grid grid-cols-1 gap-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.amount)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.value.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last updated: {new Date(passiveIncome.last_updated).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

export default PassiveIncomeSection