import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { pluginsApi, cashHoldingsApi } from '../services/api'
import { ManualEntrySchema } from '../types'
import SmartDynamicForm from '../components/SmartDynamicForm'

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

function CashHoldings() {
  const [cashHoldings, setCashHoldings] = useState<CashHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  
  // Form states
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadCashHoldings()
    loadSchema()
  }, [])

  const loadCashHoldings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await cashHoldingsApi.getAll()
      setCashHoldings(data)
    } catch (err) {
      console.error('Failed to load cash holdings:', err)
      setError('Failed to load cash holdings. Please try again.')
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatPercentage = (rate: number | undefined) => {
    if (rate === undefined || rate === null) return 'N/A'
    return `${rate}%`
  }

  const getTotalBalance = () => {
    return cashHoldings.reduce((sum, holding) => sum + holding.current_balance, 0)
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

      {/* Cash Holdings List/Grid */}
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountTypeColor(holding.account_type)}`}>
                    {getAccountTypeName(holding.account_type)}
                  </span>
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
    </div>
  )
}

export default CashHoldings