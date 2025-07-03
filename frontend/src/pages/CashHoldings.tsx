import React, { Component, ErrorInfo, useMemo } from 'react'
import { Wallet, Building, Eye, Edit2, Trash2, AlertTriangle, Shield, Globe, TrendingUp, Clock, DollarSign, Percent, Activity, Plus, RefreshCw, BarChart3, Grid3X3, List, X } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { useAssetCRUD } from '@/hooks/useAssetCRUD'
import EditEntryModal from '@/components/EditEntryModal'
import SmartDynamicForm from '@/components/SmartDynamicForm'
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

// Utility functions for cash holdings calculations
const calculateMonthlyInterest = (balance: number, annualRate: number): number => {
  return (balance * (annualRate / 100)) / 12
}

const calculateAnnualProjection = (balance: number, annualRate: number, monthlyContribution: number = 0): number => {
  const monthlyRate = (annualRate / 100) / 12
  let projectedBalance = balance
  
  for (let month = 0; month < 12; month++) {
    projectedBalance = (projectedBalance + monthlyContribution) * (1 + monthlyRate)
  }
  
  return projectedBalance
}

const getAccountTypeInfo = (accountType: string) => {
  const typeMap: Record<string, { icon: any, color: string, riskLevel: string }> = {
    'checking': { icon: DollarSign, color: 'blue', riskLevel: 'FDIC Insured' },
    'savings': { icon: Wallet, color: 'green', riskLevel: 'FDIC Insured' },
    'money_market': { icon: TrendingUp, color: 'purple', riskLevel: 'FDIC Insured' },
    'cd': { icon: Clock, color: 'orange', riskLevel: 'FDIC Insured' },
    'high_yield': { icon: Percent, color: 'emerald', riskLevel: 'FDIC Insured' },
    'brokerage': { icon: Activity, color: 'red', riskLevel: 'SIPC Protected' }
  }
  
  return typeMap[accountType.toLowerCase()] || { icon: Wallet, color: 'gray', riskLevel: 'Unknown' }
}

const getInstitutionTypeInfo = (institutionName: string) => {
  const name = institutionName.toLowerCase()
  if (name.includes('credit union') || name.includes('cu ')) {
    return { icon: Shield, type: 'Credit Union', color: 'blue' }
  }
  if (name.includes('online') || name.includes('ally') || name.includes('marcus') || name.includes('capital one')) {
    return { icon: Globe, type: 'Online Bank', color: 'purple' }
  }
  if (name.includes('schwab') || name.includes('fidelity') || name.includes('vanguard')) {
    return { icon: Activity, type: 'Brokerage', color: 'red' }
  }
  return { icon: Building, type: 'Bank', color: 'green' }
}

const getInterestRateColor = (rate: number): string => {
  if (rate >= 2) return 'text-green-600 dark:text-green-400'
  if (rate >= 1) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-gray-600 dark:text-gray-400'
}

const getAccountStatus = (holding: CashHolding): { status: string, color: string, icon: any } => {
  const updatedDate = new Date(holding.updated_at)
  const daysSinceUpdate = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
  const interestRate = holding.interest_rate || 0
  
  if (daysSinceUpdate > 90) {
    return { status: 'Dormant', color: 'gray', icon: Clock }
  }
  if (interestRate >= 2) {
    return { status: 'High Yield', color: 'green', icon: TrendingUp }
  }
  if (daysSinceUpdate <= 30) {
    return { status: 'Active', color: 'blue', icon: Activity }
  }
  return { status: 'Standard', color: 'gray', icon: Wallet }
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
) => {
  const accountTypeInfo = getAccountTypeInfo(holding.account_type)
  const institutionInfo = getInstitutionTypeInfo(holding.institution_name)
  const accountStatus = getAccountStatus(holding)
  const monthlyInterest = holding.interest_rate ? calculateMonthlyInterest(holding.current_balance, holding.interest_rate) : 0
  const annualProjection = holding.interest_rate ? calculateAnnualProjection(holding.current_balance, holding.interest_rate, holding.monthly_contribution) : 0
  const AccountTypeIcon = accountTypeInfo.icon
  const InstitutionIcon = institutionInfo.icon
  const StatusIcon = accountStatus.icon

  return (
    <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <InstitutionIcon className={`w-5 h-5 mr-2 text-${institutionInfo.color}-500`} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {holding.institution_name}
            </h3>
            <span className={`ml-2 px-2 py-1 text-xs rounded-full bg-${institutionInfo.color}-100 text-${institutionInfo.color}-800 dark:bg-${institutionInfo.color}-900 dark:text-${institutionInfo.color}-200`}>
              {institutionInfo.type}
            </span>
          </div>
          <div className="flex items-center mb-1">
            <AccountTypeIcon className={`w-4 h-4 mr-1 text-${accountTypeInfo.color}-500`} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {holding.account_name} ({holding.account_type.replace('_', ' ')})
            </p>
          </div>
          <div className="flex items-center justify-between mb-3">
            {holding.account_number_last4 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ****{holding.account_number_last4}
              </p>
            )}
            <div className="flex items-center">
              <StatusIcon className={`w-3 h-3 mr-1 text-${accountStatus.color}-500`} />
              <span className={`text-xs px-2 py-1 rounded-full bg-${accountStatus.color}-100 text-${accountStatus.color}-800 dark:bg-${accountStatus.color}-900 dark:text-${accountStatus.color}-200`}>
                {accountStatus.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(holding.current_balance)}
        </p>
      </div>

      {/* Enhanced Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        {holding.interest_rate && (
          <div>
            <p className="text-gray-500 dark:text-gray-400">Interest Rate</p>
            <p className={`font-medium ${getInterestRateColor(holding.interest_rate)}`}>
              {holding.interest_rate}% APY
            </p>
          </div>
        )}
        {monthlyInterest > 0 && (
          <div>
            <p className="text-gray-500 dark:text-gray-400">Monthly Interest</p>
            <p className="font-medium text-green-600 dark:text-green-400">
              {formatCurrency(monthlyInterest)}
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
        {annualProjection > holding.current_balance && (
          <div>
            <p className="text-gray-500 dark:text-gray-400">12-Month Projection</p>
            <p className="font-medium text-blue-600 dark:text-blue-400">
              {formatCurrency(annualProjection)}
            </p>
          </div>
        )}
      </div>

      {/* Risk Level */}
      <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
        <p className="text-xs text-gray-500 dark:text-gray-400">Protection</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {accountTypeInfo.riskLevel}
        </p>
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
}

// Summary cards renderer
const CashHoldingSummaryCards = (holdings: CashHolding[]) => {
  const totalBalance = holdings.reduce((sum, h) => sum + h.current_balance, 0)
  const totalAccounts = holdings.length
  const institutionCount = new Set(holdings.map(h => h.institution_name)).size

  // Calculate FDIC coverage
  const institutionBalances = new Map<string, number>()
  holdings.forEach(h => {
    const current = institutionBalances.get(h.institution_name) || 0
    institutionBalances.set(h.institution_name, current + h.current_balance)
  })
  
  const fdic_covered = Array.from(institutionBalances.values())
    .reduce((sum, balance) => sum + Math.min(balance, 250000), 0)
  const fdic_exposed = totalBalance - fdic_covered

  // Calculate weighted average interest rate
  const totalInterestEarning = holdings
    .filter(h => h.interest_rate && h.interest_rate > 0)
    .reduce((sum, h) => sum + h.current_balance, 0)
  const weightedRate = totalInterestEarning > 0 
    ? holdings
        .filter(h => h.interest_rate && h.interest_rate > 0)
        .reduce((sum, h) => sum + (h.current_balance * (h.interest_rate || 0)), 0) / totalInterestEarning
    : 0

  // Find best performing account
  const bestAccount = holdings
    .filter(h => h.interest_rate && h.interest_rate > 0)
    .sort((a, b) => (b.interest_rate || 0) - (a.interest_rate || 0))[0]

  // Separate liquid vs time-locked funds
  const liquidFunds = holdings
    .filter(h => h.account_type !== 'cd')
    .reduce((sum, h) => sum + h.current_balance, 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <DollarSign className="w-4 h-4 text-green-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cash</h3>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(totalBalance)}
        </p>
      </div>
      
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <Activity className="w-4 h-4 text-blue-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Liquid Assets</h3>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(liquidFunds)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {((liquidFunds / totalBalance) * 100).toFixed(1)}% of total
        </p>
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <Shield className="w-4 h-4 text-green-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">FDIC Protected</h3>
        </div>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(fdic_covered)}
        </p>
        {fdic_exposed > 0 && (
          <p className="text-xs text-orange-600 dark:text-orange-400">
            {formatCurrency(fdic_exposed)} exposed
          </p>
        )}
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <Percent className="w-4 h-4 text-purple-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Rate</h3>
        </div>
        <p className={`text-2xl font-bold ${getInterestRateColor(weightedRate)}`}>
          {weightedRate.toFixed(2)}%
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Weighted average
        </p>
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Best Rate</h3>
        </div>
        {bestAccount ? (
          <>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {bestAccount.interest_rate}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {bestAccount.institution_name}
            </p>
          </>
        ) : (
          <p className="text-2xl font-bold text-gray-400">
            0%
          </p>
        )}
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-2">
          <Building className="w-4 h-4 text-gray-500 mr-1" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Institutions</h3>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {institutionCount}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {totalAccounts} total accounts
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

// Custom list renderer for institution-based grouping
const CashHoldingListView: React.FC<{
  holdings: CashHolding[]
  actions: { onEdit: (holding: CashHolding) => void, onView: (holding: CashHolding) => void, onDelete: (holding: CashHolding) => void }
}> = ({ holdings, actions }) => {
  // Group holdings by institution
  const groupedHoldings = useMemo(() => {
    const groups = holdings.reduce((acc, holding) => {
      const key = holding.institution_name
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(holding)
      return acc
    }, {} as Record<string, CashHolding[]>)

    return Object.entries(groups).map(([institutionName, institutionHoldings]) => ({
      institutionName,
      holdings: institutionHoldings,
      totalValue: institutionHoldings.reduce((sum, h) => sum + h.current_balance, 0),
      avgInterestRate: institutionHoldings
        .filter(h => h.interest_rate && h.interest_rate > 0)
        .reduce((sum, h, _, arr) => sum + (h.interest_rate || 0) / arr.length, 0)
    }))
  }, [holdings])

  // Generate pie chart data for a specific institution
  const getInstitutionPieData = (institutionHoldings: CashHolding[]) => {
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16']
    return institutionHoldings
      .filter(h => h.current_balance > 0)
      .map((holding, index) => ({
        name: holding.account_name,
        value: holding.current_balance,
        color: COLORS[index % COLORS.length]
      }))
  }

  if (holdings.length === 0) {
    return (
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
        <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cash holdings found</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Get started by adding your first cash account.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupedHoldings.map(({ institutionName, holdings: institutionHoldings, totalValue, avgInterestRate }) => {
        const institutionInfo = getInstitutionTypeInfo(institutionName)
        const InstitutionIcon = institutionInfo.icon
        const pieData = getInstitutionPieData(institutionHoldings)

        return (
          <div key={institutionName} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
            {/* Institution Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Institution Pie Chart */}
                <div className="flex-shrink-0">
                  <ChartErrorBoundary>
                    <ResponsiveContainer width={60} height={60}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          outerRadius={25}
                          fill="#8884d8"
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${institutionName}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Balance']}
                          labelFormatter={(name) => `${name}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartErrorBoundary>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <InstitutionIcon className={`w-5 h-5 text-${institutionInfo.color}-500`} />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {institutionName}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full bg-${institutionInfo.color}-100 text-${institutionInfo.color}-800 dark:bg-${institutionInfo.color}-900 dark:text-${institutionInfo.color}-200`}>
                      {institutionInfo.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalValue)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {institutionHoldings.length} account{institutionHoldings.length !== 1 ? 's' : ''}
                    </span>
                    {avgInterestRate > 0 && (
                      <span className={`text-sm font-medium ${getInterestRateColor(avgInterestRate)}`}>
                        {avgInterestRate.toFixed(2)}% avg. rate
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Holdings List */}
            <div className="space-y-3">
              {institutionHoldings.map((holding) => {
                const accountTypeInfo = getAccountTypeInfo(holding.account_type)
                const accountStatus = getAccountStatus(holding)
                const AccountTypeIcon = accountTypeInfo.icon
                const StatusIcon = accountStatus.icon
                const progressPercentage = (holding.current_balance / totalValue) * 100

                return (
                  <div key={holding.id} className={`border-l-4 border-${accountTypeInfo.color}-500 pl-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-r`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <AccountTypeIcon className={`w-4 h-4 text-${accountTypeInfo.color}-500`} />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {holding.account_name}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          ({holding.account_type.replace('_', ' ')})
                        </span>
                        <div className="flex items-center">
                          <StatusIcon className={`w-3 h-3 mr-1 text-${accountStatus.color}-500`} />
                          <span className={`text-xs px-2 py-1 rounded-full bg-${accountStatus.color}-100 text-${accountStatus.color}-800 dark:bg-${accountStatus.color}-900 dark:text-${accountStatus.color}-200`}>
                            {accountStatus.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {holding.interest_rate && (
                          <span className={`text-sm font-medium ${getInterestRateColor(holding.interest_rate)}`}>
                            {holding.interest_rate}% APY
                          </span>
                        )}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => actions.onView(holding)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="View Details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => actions.onEdit(holding)}
                            className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => actions.onDelete(holding)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(holding.current_balance)}
                        </span>
                        {holding.account_number_last4 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ****{holding.account_number_last4}
                          </span>
                        )}
                      </div>
                      
                      {/* Progress bar showing relative size within institution */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {progressPercentage.toFixed(1)}%
                        </span>
                        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                          <div 
                            className={`h-2 bg-${accountTypeInfo.color}-500 rounded-full`}
                            style={{ width: `${Math.max(progressPercentage, 5)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
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
  const [viewMode, setViewMode] = React.useState<'grid' | 'list' | 'charts'>('grid')
  
  // Always call useAssetCRUD hook
  const [state, actions] = useAssetCRUD(cashHoldingsConfig)
  
  const {
    items: holdings,
    loading,
    refreshing,
    error,
    addModalOpen,
    editModalOpen,
    viewModalOpen, 
    deleteModalOpen,
    selectedItem,
    schema
  } = state
  
  const {
    openAddModal,
    openEditModal,
    openViewModal,
    openDeleteModal,
    closeModals,
    handleCreate,
    handleUpdate,
    handleDelete,
    refreshItems
  } = actions
  
  const listActions = {
    onEdit: (holding: CashHolding) => {
      openEditModal(holding)
    },
    onView: (holding: CashHolding) => {
      openViewModal(holding)
    },
    onDelete: (holding: CashHolding) => {
      openDeleteModal(holding)
    }
  }

  const PageIcon = cashHoldingsConfig.icon

  // Create view mode handlers to avoid type narrowing issues
  const handleViewModeChange = (mode: 'grid' | 'list' | 'charts') => {
    setViewMode(mode)
  }

  // Always use custom implementation to ensure proper view mode control
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <PageIcon className="w-8 h-8 mr-3 text-primary-600" />
            {cashHoldingsConfig.title}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {cashHoldingsConfig.description}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('charts')}
              className={`px-3 py-2 text-sm font-medium rounded-r-lg ${
                viewMode === 'charts'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={refreshItems}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add {cashHoldingsConfig.entityName}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {cashHoldingsConfig.renderSummaryCards && cashHoldingsConfig.renderSummaryCards(holdings)}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : holdings.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <PageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No cash holdings found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by adding your first cash account.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First {cashHoldingsConfig.entityName}
          </button>
        </div>
      ) : viewMode === 'charts' && cashHoldingsConfig.renderCharts ? (
        cashHoldingsConfig.renderCharts(holdings)
      ) : viewMode === 'list' ? (
        <CashHoldingListView holdings={holdings} actions={listActions} />
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {holdings.map((holding) => {
            const cardActions = {
              onEdit: () => listActions.onEdit(holding),
              onView: () => listActions.onView(holding),
              onDelete: () => listActions.onDelete(holding)
            }
            return (
              <div key={holding.id}>
                {cashHoldingsConfig.renderCard ? 
                  cashHoldingsConfig.renderCard(holding, cardActions) :
                  <div>Default card for {holding.id}</div>
                }
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add New {cashHoldingsConfig.entityName}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <SmartDynamicForm
                schema={schema}
                onSubmit={handleCreate}
              />
            </div>
          </div>
        </div>
      )}

      <EditEntryModal
        entryType={cashHoldingsConfig.entryType || ''}
        entryData={selectedItem || {}}
        title={`Edit ${cashHoldingsConfig.entityName}`}
        isOpen={editModalOpen && !!selectedItem}
        onClose={closeModals}
        onUpdate={handleUpdate}
        submitText={`Update ${cashHoldingsConfig.entityName}`}
      />

      {/* View Modal */}
      {viewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {cashHoldingsConfig.entityName} Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Institution</h4>
                <p className="text-gray-900 dark:text-white">{selectedItem.institution_name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Name</h4>
                <p className="text-gray-900 dark:text-white">{selectedItem.account_name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Balance</h4>
                <p className="text-gray-900 dark:text-white">{formatCurrency(selectedItem.current_balance)}</p>
              </div>
              {selectedItem.interest_rate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Interest Rate</h4>
                  <p className="text-gray-900 dark:text-white">{selectedItem.interest_rate}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete {cashHoldingsConfig.entityName}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete {selectedItem.account_name} at {selectedItem.institution_name}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CashHoldings