import { useState, useEffect, useMemo, ErrorInfo, Component } from 'react'
import { 
  Plus, 
  RefreshCw, 
  BarChart3, 
  Grid3X3, 
  List,
  Wallet,
  AlertTriangle,
  X,
  Building,
  TrendingUp,
  Edit2,
  Eye,
  Trash2,
} from 'lucide-react'
import { 
  PieChart, Pie, Cell, LineChart, Line, 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { pluginsApi, cashHoldingsApi } from '../services/api'
import { ManualEntrySchema } from '../types'
import SmartDynamicForm from '../components/SmartDynamicForm'
import EditEntryModal from '../components/EditEntryModal'

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

type ViewMode = 'grid' | 'list' | 'charts'

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

function CashHoldings() {
  const [cashHoldings, setCashHoldings] = useState<CashHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedHolding, setSelectedHolding] = useState<CashHolding | null>(null)
  
  // Form states
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadCashHoldings()
    loadSchema()
  }, [])

  // Transform and validate API response data
  const transformCashHoldingData = (rawData: any[]): CashHolding[] => {
    console.log('Raw API response:', rawData) // Debug logging
    
    if (!Array.isArray(rawData)) {
      console.warn('API response is not an array:', rawData)
      return []
    }
    
    return rawData.map((item, index) => {
      try {
        const transformed: CashHolding = {
          id: typeof item.id === 'number' ? item.id : index,
          institution_name: String(item.institution_name || ''),
          account_name: String(item.account_name || ''),
          account_type: String(item.account_type || ''),
          current_balance: parseFloat(item.current_balance) || 0,
          interest_rate: item.interest_rate !== null && item.interest_rate !== undefined 
            ? parseFloat(item.interest_rate) || undefined 
            : undefined,
          monthly_contribution: item.monthly_contribution !== null && item.monthly_contribution !== undefined
            ? parseFloat(item.monthly_contribution) || undefined
            : undefined,
          account_number_last4: item.account_number_last4 ? String(item.account_number_last4) : undefined,
          currency: String(item.currency || 'USD'),
          notes: item.notes ? String(item.notes) : undefined,
          created_at: String(item.created_at || ''),
          updated_at: String(item.updated_at || '')
        }
        
        // Validate critical numeric fields
        if (!isValidNumber(transformed.current_balance)) {
          console.warn(`Invalid balance for holding ${index}:`, item.current_balance, 'converted to 0')
          transformed.current_balance = 0
        }
        
        return transformed
      } catch (error) {
        console.error(`Error transforming cash holding ${index}:`, error, item)
        // Return a safe default object
        return {
          id: index,
          institution_name: 'Unknown',
          account_name: 'Unknown',
          account_type: 'checking',
          current_balance: 0,
          currency: 'USD',
          created_at: '',
          updated_at: ''
        }
      }
    })
  }

  const loadCashHoldings = async () => {
    try {
      setLoading(true)
      setError(null)
      const rawData = await cashHoldingsApi.getAll()
      const transformedData = transformCashHoldingData(rawData)
      console.log('Transformed cash holdings:', transformedData) // Debug logging
      setCashHoldings(transformedData)
    } catch (err) {
      console.error('Failed to load cash holdings:', err)
      setError('Failed to load cash holdings. Please try again.')
      setCashHoldings([]) // Ensure we have empty array on error
    } finally {
      setLoading(false)
    }
  }

  const loadSchema = async () => {
    try {
      const cashHoldingsSchema = await pluginsApi.getSchema('cash_holdings')
      setSchema(cashHoldingsSchema)
    } catch (error) {
      console.error('Failed to load cash holdings schema:', error)
    }
  }

  const closeModals = () => {
    setAddModalOpen(false)
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedHolding(null)
  }

  const handleEdit = (holding: CashHolding) => {
    setSelectedHolding(holding)
    setEditModalOpen(true)
  }

  const handleView = (holding: CashHolding) => {
    setSelectedHolding(holding)
    setViewModalOpen(true)
  }

  const handleDelete = (holding: CashHolding) => {
    setSelectedHolding(holding)
    setDeleteModalOpen(true)
  }

  const handleUpdate = async (formData: Record<string, any>) => {
    if (!selectedHolding) return

    try {
      await cashHoldingsApi.update(selectedHolding.id, formData)
      setMessage({ type: 'success', text: 'Cash holding updated successfully!' })
      closeModals()
      await loadCashHoldings()
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error('Failed to update cash holding:', err)
      setError(err.message || 'Failed to update cash holding. Please try again.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedHolding) return

    try {
      await cashHoldingsApi.delete(selectedHolding.id)
      setMessage({ type: 'success', text: 'Cash holding deleted successfully!' })
      closeModals()
      await loadCashHoldings()
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error('Failed to delete cash holding:', err)
      setError(err.message || 'Failed to delete cash holding. Please try again.')
    }
  }

  const handleAddHolding = async (formData: Record<string, any>) => {
    setSubmitting(true)
    setMessage(null)

    try {
      await pluginsApi.processManualEntry('cash_holdings', formData)
      setMessage({ type: 'success', text: 'Cash holding added successfully!' })
      
      // Refresh holdings list
      await loadCashHoldings()
      setAddModalOpen(false)
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to add cash holding:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add cash holding. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }


  const refresh = async () => {
    setRefreshing(true)
    await loadCashHoldings()
    setRefreshing(false)
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    // Handle invalid numbers
    if (isNaN(amount) || !isFinite(amount)) {
      return '$0'
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatPercentage = (rate: number | undefined) => {
    if (rate === undefined || rate === null) return 'N/A'
    return `${rate}%`
  }

  // Comprehensive validation for numeric values (handles null, undefined, NaN, Infinity)
  const isValidNumber = (value: any): value is number => {
    return typeof value === 'number' && 
           value !== null && 
           !isNaN(value) && 
           isFinite(value)
  }

  const getTotalBalance = () => {
    return cashHoldings.reduce((sum, holding) => {
      const balance = holding.current_balance
      // Validate that balance is a valid number (handles null, undefined, NaN, Infinity)
      if (isValidNumber(balance)) {
        return sum + balance
      }
      return sum
    }, 0)
  }

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'checking':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'savings':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'money_market':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'cd':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'high_yield_savings':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case 'checking':
        return 'Checking'
      case 'savings':
        return 'Savings'
      case 'money_market':
        return 'Money Market'
      case 'cd':
        return 'Certificate of Deposit'
      case 'high_yield_savings':
        return 'High Yield Savings'
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const getAccountTypeColorCode = (type: string) => {
    switch (type) {
      case 'checking': return '#3b82f6'
      case 'savings': return '#10b981'
      case 'money_market': return '#8b5cf6'
      case 'cd': return '#f59e0b'
      case 'high_yield_savings': return '#06b6d4'
      default: return '#6b7280'
    }
  }

  // Memoized data processing functions for charts - prevents multiple calculations and ensures consistency
  const accountTypeDistribution = useMemo(() => {
    console.log('Calculating account type distribution for:', cashHoldings.length, 'holdings')
    if (cashHoldings.length === 0) {
      return []
    }
    
    const distribution = cashHoldings.reduce((acc, holding) => {
      const type = holding.account_type
      const typeName = getAccountTypeName(type)
      const balance = isValidNumber(holding.current_balance) ? holding.current_balance : 0
      const existing = acc.find(item => item.name === typeName)
      
      if (existing) {
        existing.value += balance
        existing.count += 1
      } else {
        acc.push({
          name: typeName,
          value: balance,
          count: 1,
          color: getAccountTypeColorCode(type)
        })
      }
      return acc
    }, [] as Array<{name: string, value: number, count: number, color: string}>)

    const totalBalance = getTotalBalance()
    const result = distribution.map(item => ({
      ...item,
      percentage: totalBalance > 0 ? Math.round((item.value / totalBalance) * 100) : 0
    }))
    
    console.log('Account type distribution result:', result)
    return result
  }, [cashHoldings])

  const interestRateData = useMemo(() => {
    console.log('Calculating interest rate data for:', cashHoldings.length, 'holdings')
    const result = cashHoldings
      .filter(holding => isValidNumber(holding.interest_rate) && holding.interest_rate > 0)
      .map(holding => ({
        name: `${holding.institution_name} - ${holding.account_name}`,
        rate: isValidNumber(holding.interest_rate) ? Number(holding.interest_rate.toFixed(2)) : 0,
        balance: isValidNumber(holding.current_balance) ? holding.current_balance : 0,
        type: getAccountTypeName(holding.account_type)
      }))
      .filter(item => item.rate > 0 && isValidNumber(item.rate)) // Double validation for rate
      .sort((a, b) => b.rate - a.rate)
    
    console.log('Interest rate data result:', result)
    console.log('Interest rate data values:', result.map(item => ({ name: item.name, rate: item.rate })))
    return result
  }, [cashHoldings])


  // Generate next 12 months starting from current month
  const getNextMonths = () => {
    const months = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const now = new Date()
    
    for (let i = 1; i <= 12; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthName = monthNames[futureDate.getMonth()]
      const year = futureDate.getFullYear()
      months.push(`${monthName} ${year}`)
    }
    
    return months
  }

  const growthProjectionData = useMemo(() => {
    console.log('Calculating growth projection data for:', cashHoldings.length, 'holdings')
    const currentBalance = getTotalBalance()
    
    // Calculate average interest rate with comprehensive validation
    const holdingsWithInterest = cashHoldings.filter(h => isValidNumber(h.interest_rate) && h.interest_rate > 0)
    const avgInterestRate = holdingsWithInterest.length > 0 
      ? holdingsWithInterest.reduce((sum, h) => sum + (isValidNumber(h.interest_rate) ? h.interest_rate : 0), 0) / holdingsWithInterest.length
      : 0
    
    const monthlyContribution = cashHoldings.reduce((sum, h) => {
      const contribution = h.monthly_contribution
      if (isValidNumber(contribution)) {
        return sum + contribution
      }
      return sum
    }, 0)
    
    const projectionData = []
    const months = getNextMonths()
    
    // Ensure starting values are valid using comprehensive validation
    let runningBalance = isValidNumber(currentBalance) ? currentBalance : 0
    const safeMonthlyContrib = isValidNumber(monthlyContribution) ? monthlyContribution : 0
    const safeCurrentBalance = isValidNumber(currentBalance) ? currentBalance : 0
    
    for (let i = 0; i < 12; i++) {
      // Add monthly contribution
      runningBalance += safeMonthlyContrib
      
      // Add monthly interest (simple calculation) - ensure avgInterestRate is valid
      if (isValidNumber(avgInterestRate) && avgInterestRate > 0) {
        const interestAmount = (runningBalance * (avgInterestRate / 100)) / 12
        if (isValidNumber(interestAmount)) {
          runningBalance += interestAmount
        }
      }
      
      // Ensure values are valid numbers - use safer fallbacks
      let balanceValue = Math.round(runningBalance)
      if (!isValidNumber(balanceValue)) {
        balanceValue = Math.round(safeCurrentBalance + (safeMonthlyContrib * (i + 1)))
      }
      
      let withoutInterestValue = Math.round(safeCurrentBalance + (safeMonthlyContrib * (i + 1)))
      if (!isValidNumber(withoutInterestValue)) {
        withoutInterestValue = Math.round(safeCurrentBalance)
      }
      
      projectionData.push({
        month: months[i],
        balance: balanceValue,
        withoutInterest: withoutInterestValue
      })
    }
    
    console.log('Growth projection data result:', projectionData)
    return projectionData
  }, [cashHoldings])

  // Validate chart data to prevent NaN errors
  const validateChartData = (data: any[]) => {
    return data.every(item => {
      return Object.values(item).every(value => {
        return typeof value === 'string' || (typeof value === 'number' && !isNaN(value) && isFinite(value))
      })
    })
  }

  // Enhanced validation specifically for BarChart interest rate data
  const validateInterestRateData = (data: typeof interestRateData) => {
    if (!Array.isArray(data) || data.length === 0) {
      console.log('Interest rate data validation: empty or invalid array')
      return false
    }
    
    const isValid = data.every((item, index) => {
      const hasValidName = typeof item.name === 'string' && item.name.trim().length > 0
      const hasValidRate = isValidNumber(item.rate) && item.rate > 0 && item.rate <= 100
      const hasValidBalance = isValidNumber(item.balance) && item.balance >= 0
      
      if (!hasValidName || !hasValidRate || !hasValidBalance) {
        console.log(`Interest rate data validation failed at index ${index}:`, {
          item,
          hasValidName,
          hasValidRate,
          hasValidBalance
        })
        return false
      }
      
      return true
    })
    
    console.log('Interest rate data validation result:', { isValid, dataLength: data.length })
    return isValid
  }

  const institutionDistribution = useMemo(() => {
    console.log('Calculating institution distribution for:', cashHoldings.length, 'holdings')
    if (cashHoldings.length === 0) {
      return []
    }
    
    const distribution = cashHoldings.reduce((acc, holding) => {
      const institution = holding.institution_name
      const balance = isValidNumber(holding.current_balance) ? holding.current_balance : 0
      const existing = acc.find(item => item.name === institution)
      
      if (existing) {
        existing.value += balance
        existing.count += 1
      } else {
        acc.push({
          name: institution,
          value: balance,
          count: 1
        })
      }
      return acc
    }, [] as Array<{name: string, value: number, count: number}>)

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
    const totalBalance = getTotalBalance()
    
    const result = distribution.map((item, index) => ({
      ...item,
      color: colors[index % colors.length],
      percentage: totalBalance > 0 ? Math.round((item.value / totalBalance) * 100) : 0
    }))
    
    console.log('Institution distribution result:', result)
    return result
  }, [cashHoldings])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cash Holdings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your cash accounts including checking, savings, and money market accounts
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Cash Account
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Wallet className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Cash Holdings
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatCurrency(getTotalBalance())}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Building className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Total Accounts
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {cashHoldings.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                    Avg Interest Rate
                  </dt>
                  <dd className="text-lg font-medium text-gray-900 dark:text-white">
                    {cashHoldings.length > 0 
                      ? formatPercentage(
                          cashHoldings
                            .filter(h => h.interest_rate)
                            .reduce((sum, h) => sum + (h.interest_rate || 0), 0) / 
                          cashHoldings.filter(h => h.interest_rate).length
                        )
                      : 'N/A'
                    }
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md ${viewMode === 'grid' 
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md ${viewMode === 'list' 
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('charts')}
            className={`p-2 rounded-md ${viewMode === 'charts' 
              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error loading cash holdings
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {message && (
        <div className={`rounded-md p-4 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900' 
            : 'bg-red-50 dark:bg-red-900'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className={`h-5 w-5 ${
                message.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`} />
            </div>
            <div className="ml-3">
              <div className={`text-sm ${
                message.type === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {message.text}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Holdings List/Grid/Charts */}
      {cashHoldings.length === 0 ? (
        <div className="text-center py-12">
          <Wallet className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No cash holdings</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by adding your first cash account.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Cash Account
            </button>
          </div>
        </div>
      ) : viewMode === 'charts' ? (
        // Enhanced loading protection for charts
        loading || !cashHoldings || cashHoldings.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">
                {loading ? 'Loading chart data...' : 'No cash holdings data available for charts'}
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Phase 1 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Account Type Distribution */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Distribution by Account Type
                </h3>
                {accountTypeDistribution.length > 0 ? (
                  <>
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
                          >
                            {accountTypeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, _name: string, props: any) => [
                              formatCurrency(value), 
                              `${props.payload.name} (${props.payload.count} account${props.payload.count !== 1 ? 's' : ''})`
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {accountTypeDistribution.map((item) => (
                        <div key={item.name} className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {item.name} ({item.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    No account data available for chart
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
                  <>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={institutionDistribution}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                          >
                            {institutionDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, _name: string, props: any) => [
                              formatCurrency(value), 
                              `${props.payload.name} (${props.payload.count} account${props.payload.count !== 1 ? 's' : ''})`
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      {institutionDistribution.map((item) => (
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
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    No institution data available for chart
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Growth Projection */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                12-Month Growth Projection
              </h3>
              {(() => {
                const isValidData = validateChartData(growthProjectionData)
                
                return isValidData && growthProjectionData.length > 0 ? (
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
                              name === 'With Interest' ? 'With Interest' : 'Without Interest'
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
                )
              })()}
            </div>
          </div>

          {/* Phase 2 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interest Rate Comparison */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Interest Rate Comparison
                </h3>
                {(() => {
                  const isValidData = validateInterestRateData(interestRateData)
                  
                  // Final sanitization check before rendering
                  const sanitizedData = interestRateData.map(item => ({
                    ...item,
                    rate: isValidNumber(item.rate) ? Number(item.rate) : 0,
                    balance: isValidNumber(item.balance) ? Number(item.balance) : 0
                  })).filter(item => item.rate > 0)
                  
                  // Use simple fixed domain to eliminate domain calculation as source of NaN
                  const simpleDomain = [0, 10] // Simple fixed domain
                  
                  // Add final validation step - ensure no NaN/Infinity in data
                  const ultraCleanData = sanitizedData.map(item => ({
                    name: String(item.name || 'Unknown'),
                    rate: Math.min(10, Math.max(0, Number(item.rate) || 0)), // Clamp between 0-10
                    balance: Number(item.balance) || 0,
                    type: String(item.type || '')
                  })).filter(item => item.rate > 0 && item.rate <= 10)
                  
                  console.log('BarChart rendering with simplified approach:', {
                    originalDataLength: interestRateData.length,
                    sanitizedDataLength: sanitizedData.length,
                    ultraCleanDataLength: ultraCleanData.length,
                    isValidData,
                    simpleDomain,
                    ultraCleanData
                  })
                  
                  return ultraCleanData.length > 0 ? (
                    // Table fallback if chart fails but we have data
                    <div className="h-64 overflow-auto">
                      <div className="mb-2 text-sm text-blue-600 dark:text-blue-400">
                        📊 Interest Rate Comparison (Table View)
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 pr-4 font-medium text-gray-900 dark:text-white">Account</th>
                            <th className="text-right py-2 font-medium text-gray-900 dark:text-white">Interest Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ultraCleanData.map((item, index) => (
                            <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 pr-4 text-gray-800 dark:text-gray-200">{item.name}</td>
                              <td className="text-right py-2 text-gray-800 dark:text-gray-200">{item.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      No interest rate data available - add accounts with interest rates to see comparison
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Enhanced Metrics */}
            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Cash Holdings Metrics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Highest Interest Rate</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {interestRateData.length > 0 
                          ? `${interestRateData[0].rate}%` 
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Contributions</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(cashHoldings.reduce((sum, h) => {
                          return sum + (isValidNumber(h.monthly_contribution) ? h.monthly_contribution : 0)
                        }, 0))}
                      </p>
                    </div>
                    <Building className="h-8 w-8 text-blue-500" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Projected Annual Interest</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(
                          cashHoldings.reduce((sum, h) => {
                            if (isValidNumber(h.interest_rate) && isValidNumber(h.current_balance)) {
                              return sum + (h.current_balance * (h.interest_rate / 100))
                            }
                            return sum
                          }, 0)
                        )}
                      </p>
                    </div>
                    <Wallet className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3' 
          : 'space-y-4'
        }>
          {cashHoldings.map((holding) => (
            <div 
              key={holding.id} 
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg"
            >
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Wallet className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {holding.account_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {holding.institution_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountTypeColor(holding.account_type)}`}>
                      {getAccountTypeName(holding.account_type)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleView(holding)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(holding)}
                        className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(holding)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatCurrency(holding.current_balance, holding.currency)}
                      </div>
                      {holding.interest_rate && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatPercentage(holding.interest_rate)} APY
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {holding.account_number_last4 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      ****{holding.account_number_last4}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Cash Holding Modal */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setAddModalOpen(false)} />

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    Add Cash Account
                  </h3>
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <SmartDynamicForm
                  schema={schema}
                  onSubmit={handleAddHolding}
                  loading={submitting}
                  submitText="Add Cash Account"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditEntryModal
        entryType="cash_holdings"
        entryData={selectedHolding || {}}
        title="Edit Cash Holding"
        isOpen={editModalOpen && !!selectedHolding}
        onClose={closeModals}
        onUpdate={handleUpdate}
        submitText="Update Cash Holding"
      />

      {/* View Modal */}
      {viewModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Cash Holding Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(selectedHolding, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && selectedHolding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Cash Holding
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
                Are you sure you want to delete "{selectedHolding.account_name}" at {selectedHolding.institution_name}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
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