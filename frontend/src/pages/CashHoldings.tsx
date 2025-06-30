import React, { Component, ErrorInfo } from 'react'
import { Wallet, Building, Eye, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import GenericAssetPage, { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { cashHoldingsApi, pluginsApi } from '@/services/api'
import { formatCurrency } from '@/utils/formatting'

interface CashHolding {
  id: number
  institution_name: string
  account_name: string
  account_type: string
  current_balance: number
  interest_rate?: number
  monthly_contribution?: number
  account_number_last4?: string
  currency: string
  notes?: string
  created_at: string
  updated_at: string
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

// Custom card renderer for cash holdings
const CashHoldingCard = (
  holding: CashHolding, 
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
) => (
  <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="flex items-center mb-2">
          <Building className="w-5 h-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {holding.institution_name}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {holding.account_name} ({holding.account_type})
        </p>
        {holding.account_number_last4 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            ****{holding.account_number_last4}
          </p>
        )}
      </div>
    </div>

    {/* Balance */}
    <div className="mb-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
        {formatCurrency(holding.current_balance)}
      </p>
    </div>

    {/* Additional Info */}
    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
      {holding.interest_rate && (
        <div>
          <p className="text-gray-500 dark:text-gray-400">Interest Rate</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {holding.interest_rate}%
          </p>
        </div>
      )}
      {holding.monthly_contribution && (
        <div>
          <p className="text-gray-500 dark:text-gray-400">Monthly Contribution</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatCurrency(holding.monthly_contribution)}
          </p>
        </div>
      )}
    </div>

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
const CashHoldingSummaryCards = (holdings: CashHolding[]) => {
  const totalBalance = holdings.reduce((sum, h) => sum + h.current_balance, 0)
  const totalAccounts = holdings.length
  const avgBalance = totalAccounts > 0 ? totalBalance / totalAccounts : 0
  const institutionCount = new Set(holdings.map(h => h.institution_name)).size

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Cash</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalBalance)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Accounts</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {totalAccounts}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Average Balance</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(avgBalance)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Institutions</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {institutionCount}
        </p>
      </div>
    </div>
  )
}

// Comprehensive chart functionality for cash holdings
const CashHoldingCharts = (holdings: CashHolding[]): JSX.Element => {
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']

  // Account Type Distribution
  const accountTypeDistribution = (() => {
    const typeMap = new Map<string, number>()
    
    holdings.forEach(holding => {
      const type = holding.account_type || 'Unknown'
      const current = typeMap.get(type) || 0
      typeMap.set(type, current + holding.current_balance)
    })

    return Array.from(typeMap.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value], index) => ({ 
        name, 
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
  })()

  // Institution Distribution
  const institutionDistribution = (() => {
    const institutionMap = new Map<string, number>()
    
    holdings.forEach(holding => {
      const institution = holding.institution_name || 'Unknown'
      const current = institutionMap.get(institution) || 0
      institutionMap.set(institution, current + holding.current_balance)
    })

    return Array.from(institutionMap.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value], index) => ({ 
        name, 
        value,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
  })()

  // Interest Rate Data
  const interestRateData = holdings
    .filter(holding => holding.interest_rate && holding.interest_rate > 0)
    .map(holding => ({
      name: `${holding.institution_name} - ${holding.account_name}`,
      rate: holding.interest_rate || 0,
      balance: holding.current_balance,
      type: holding.account_type
    }))
    .sort((a, b) => b.rate - a.rate)

  // Growth Projection (12 months)
  const growthProjectionData = (() => {
    const totalBalance = holdings.reduce((sum, h) => sum + h.current_balance, 0)
    const avgInterestRate = holdings
      .filter(h => h.interest_rate && h.interest_rate > 0)
      .reduce((sum, h, _, arr) => sum + (h.interest_rate || 0) / arr.length, 0)
    const totalMonthlyContributions = holdings.reduce((sum, h) => sum + (h.monthly_contribution || 0), 0)

    const monthlyInterestRate = (avgInterestRate || 0) / 100 / 12
    
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1
      const monthName = new Date(2024, index).toLocaleDateString('en-US', { month: 'short' })
      
      // With interest compound calculation
      let balanceWithInterest = totalBalance
      let balanceWithoutInterest = totalBalance
      
      for (let i = 0; i < month; i++) {
        balanceWithInterest = balanceWithInterest * (1 + monthlyInterestRate) + totalMonthlyContributions
        balanceWithoutInterest += totalMonthlyContributions
      }
      
      return {
        month: monthName,
        balance: Math.round(balanceWithInterest),
        withoutInterest: Math.round(balanceWithoutInterest)
      }
    })
  })()

  const formatPercentage = (value: number) => `${value.toFixed(2)}%`

  if (holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No cash holdings data available for charts</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Growth Projection Chart */}
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            12-Month Growth Projection
          </h3>
          {growthProjectionData.length > 0 ? (
            <ChartErrorBoundary>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={growthProjectionData}
                    margin={{ left: 80, right: 30, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      width={80}
                      tickFormatter={(value) => formatCurrency(value)}
                      domain={[0, 'dataMax']}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name === 'balance' ? 'With Interest' : 'Without Interest'
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="With Interest"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="withoutInterest" 
                      stroke="#6b7280" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Without Interest"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartErrorBoundary>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
              No valid projection data available
            </div>
          )}
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Type Distribution */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribution by Account Type
            </h3>
            {accountTypeDistribution.length > 0 ? (
              <ChartErrorBoundary>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={accountTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {accountTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Balance']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartErrorBoundary>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                No account type data available
              </div>
            )}
          </div>
        </div>

        {/* Institution Distribution */}
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribution by Institution
            </h3>
            {institutionDistribution.length > 0 ? (
              <ChartErrorBoundary>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={institutionDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {institutionDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Balance']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartErrorBoundary>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                No institution data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interest Rate Comparison */}
      {interestRateData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Interest Rate Comparison
            </h3>
            <div className="h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-white">Account</th>
                    <th className="text-right py-2 pr-4 font-medium text-gray-900 dark:text-white">Balance</th>
                    <th className="text-right py-2 font-medium text-gray-900 dark:text-white">Interest Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {interestRateData.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white">{item.name}</td>
                      <td className="py-2 pr-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.balance)}</td>
                      <td className="py-2 text-right font-medium text-green-600 dark:text-green-400">{formatPercentage(item.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Configuration for the generic page
const cashHoldingsConfig: GenericAssetPageConfig<CashHolding> = {
  // API configuration
  fetchAll: cashHoldingsApi.getAll,
  create: cashHoldingsApi.create,
  update: cashHoldingsApi.update,
  delete: cashHoldingsApi.delete,
  fetchSchema: () => pluginsApi.getSchema('cash_holdings'),
  
  // Page configuration
  title: 'Cash Holdings',
  description: 'Manage your cash accounts, savings, and liquid investments',
  icon: Wallet,
  entityName: 'Cash Holding',
  
  // Rendering configuration
  renderCard: CashHoldingCard,
  renderSummaryCards: CashHoldingSummaryCards,
  renderCharts: CashHoldingCharts,
  
  // Feature configuration
  supportedViewModes: ['grid', 'list', 'charts'],
  enableAdd: true,
  enableRefresh: true,
  
  // Modal configuration
  entryType: 'cash_holdings',
  getFormData: (holding) => ({
    institution_name: holding.institution_name,
    account_name: holding.account_name,
    account_type: holding.account_type,
    current_balance: holding.current_balance,
    interest_rate: holding.interest_rate || null,
    monthly_contribution: holding.monthly_contribution || null,
    account_number_last4: holding.account_number_last4 || '',
    currency: holding.currency || 'USD',
    notes: holding.notes || ''
  })
}

function CashHoldings() {
  return <GenericAssetPage config={cashHoldingsConfig} />
}

export default CashHoldings