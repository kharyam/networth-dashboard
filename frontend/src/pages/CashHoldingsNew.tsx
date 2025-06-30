import { Wallet, Building, Eye, Edit2, Trash2 } from 'lucide-react'
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
  
  // Feature configuration
  supportedViewModes: ['grid', 'list'],
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