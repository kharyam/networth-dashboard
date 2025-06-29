import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Award, AlertCircle, Edit2, Eye, Trash2, X } from 'lucide-react'
import { equityApi } from '@/services/api'
import type { EquityGrant } from '@/types'
import MarketStatus from '@/components/MarketStatus'
import PriceRefreshControls from '@/components/PriceRefreshControls'
import EditEntryModal from '@/components/EditEntryModal'

interface EquityGrantWithValue extends EquityGrant {
  current_price?: number
  vested_value: number
  unvested_value: number
  total_value: number
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
                {Math.abs(change)}% from last refresh
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

function EquityGrantCard({ 
  grant, 
  onEdit, 
  onView, 
  onDelete 
}: { 
  grant: EquityGrantWithValue
  onEdit: (grant: EquityGrantWithValue) => void
  onView: (grant: EquityGrantWithValue) => void
  onDelete: (grant: EquityGrantWithValue) => void
}) {
  const vestedPercentage = grant.total_shares > 0 ? (grant.vested_shares / grant.total_shares) * 100 : 0
  const hasPrice = grant.current_price && grant.current_price > 0
  
  return (
    <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {grant.company_symbol || 'Unknown'} - {grant.grant_type.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Grant ID: {grant.grant_id || `#${grant.id}`}
          </p>
          {grant.grant_date && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Granted: {new Date(grant.grant_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="text-right">
          {hasPrice ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${grant.current_price?.toFixed(2)}
              </p>
            </>
          ) : (
            <div className="flex items-center text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">No Price</span>
            </div>
          )}
        </div>
      </div>

      {/* Vesting Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vesting Progress</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {vestedPercentage.toFixed(1)}% vested
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${vestedPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{grant.vested_shares.toLocaleString()} vested</span>
          <span>{grant.unvested_shares.toLocaleString()} unvested</span>
        </div>
      </div>

      {/* Values Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Vested Value</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            ${grant.vested_value.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Unvested Value</p>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            ${grant.unvested_value.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${grant.total_value.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Strike Price for Options */}
      {grant.grant_type === 'stock_options' && grant.strike_price && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Strike Price:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              ${grant.strike_price.toFixed(2)}
            </span>
          </div>
          {hasPrice && grant.current_price! > grant.strike_price && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">In-the-Money:</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                ${(grant.current_price! - grant.strike_price).toFixed(2)} per share
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onView(grant)}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(grant)}
            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(grant)}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Equity() {
  const [grants, setGrants] = useState<EquityGrantWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedGrant, setSelectedGrant] = useState<EquityGrantWithValue | null>(null)

  const fetchEquityGrants = async () => {
    try {
      const data = await equityApi.getAll()
      
      // Calculate values for each grant using existing current_price from database
      const grantsWithValues = data.map((grant) => {
        const current_price = grant.current_price || 0
        
        // Calculate values based on grant type
        let vested_value = 0
        let unvested_value = 0
        
        if (current_price > 0) {
          if (grant.grant_type === 'stock_options' && grant.strike_price) {
            // For options, value is (current_price - strike_price) * shares
            const optionValue = Math.max(0, current_price - grant.strike_price)
            vested_value = grant.vested_shares * optionValue
            unvested_value = grant.unvested_shares * optionValue
          } else {
            // For RSUs/RSAs, value is current_price * shares
            vested_value = grant.vested_shares * current_price
            unvested_value = grant.unvested_shares * current_price
          }
        }
        
        return {
          ...grant,
          current_price,
          vested_value,
          unvested_value,
          total_value: vested_value + unvested_value
        }
      })
      
      setGrants(grantsWithValues)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch equity grants:', error)
      setError('Failed to load equity grants')
    }
  }

  const handleRefreshComplete = async () => {
    await fetchEquityGrants() // Refresh grants with new prices
  }

  const closeModals = () => {
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedGrant(null)
  }

  const handleEdit = (grant: EquityGrantWithValue) => {
    setSelectedGrant(grant)
    setEditModalOpen(true)
  }

  const handleView = (grant: EquityGrantWithValue) => {
    setSelectedGrant(grant)
    setViewModalOpen(true)
  }

  const handleDelete = (grant: EquityGrantWithValue) => {
    setSelectedGrant(grant)
    setDeleteModalOpen(true)
  }

  const handleUpdate = async (formData: Record<string, any>) => {
    if (!selectedGrant) return

    try {
      await equityApi.update(selectedGrant.id, formData)
      closeModals()
      await fetchEquityGrants()
    } catch (err: any) {
      console.error('Failed to update equity grant:', err)
      setError(err.message || 'Failed to update equity grant. Please try again.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedGrant) return

    try {
      await equityApi.delete(selectedGrant.id)
      closeModals()
      await fetchEquityGrants()
    } catch (err: any) {
      console.error('Failed to delete equity grant:', err)
      setError(err.message || 'Failed to delete equity grant. Please try again.')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchEquityGrants()
      setLoading(false)
    }
    
    loadData()
  }, [])

  // Calculate totals
  const totalVestedValue = grants.reduce((sum, grant) => sum + grant.vested_value, 0)
  const totalUnvestedValue = grants.reduce((sum, grant) => sum + grant.unvested_value, 0)
  const totalEquityValue = totalVestedValue + totalUnvestedValue
  const totalVestedShares = grants.reduce((sum, grant) => sum + grant.vested_shares, 0)
  const totalUnvestedShares = grants.reduce((sum, grant) => sum + grant.unvested_shares, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equity Compensation</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your RSUs, stock options, and vesting schedules
          </p>
          <div className="mt-3">
            <MarketStatus showDetails={true} />
          </div>
        </div>
        
        {/* Price Status and Refresh */}
        <PriceRefreshControls onRefreshComplete={handleRefreshComplete} />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Equity Value"
          value={totalEquityValue}
          icon={DollarSign}
        />
        <MetricCard
          title="Vested Value"
          value={totalVestedValue}
          icon={Award}
          change={2.4}
          changeType="positive"
        />
        <MetricCard
          title="Unvested Value"
          value={totalUnvestedValue}
          icon={Calendar}
        />
        <MetricCard
          title="Total Shares"
          value={`${(totalVestedShares + totalUnvestedShares).toLocaleString()}`}
          icon={TrendingUp}
          prefix=""
        />
      </div>

      {/* Equity Grants */}
      {grants.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Equity Grants</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {grants.map((grant) => (
              <EquityGrantCard 
                key={grant.id} 
                grant={grant}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <Award className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No equity grants found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add equity grants through Manual Entry to track your vesting schedule and current values.
            </p>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditEntryModal
        entryType="morgan_stanley"
        entryData={selectedGrant || {}}
        title="Edit Equity Grant"
        isOpen={editModalOpen}
        onClose={closeModals}
        onUpdate={handleUpdate}
        submitText="Update Grant"
      />

      {/* View Modal */}
      {viewModalOpen && selectedGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Equity Grant Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Company & Grant Type</h4>
                  <p className="text-gray-900 dark:text-white">{selectedGrant.company_symbol || 'Unknown'} - {selectedGrant.grant_type.toUpperCase()}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Grant ID</h4>
                  <p className="text-gray-900 dark:text-white">{selectedGrant.grant_id || `#${selectedGrant.id}`}</p>
                </div>
                {selectedGrant.grant_date && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Grant Date</h4>
                    <p className="text-gray-900 dark:text-white">{new Date(selectedGrant.grant_date).toLocaleDateString()}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Vested Shares</h4>
                    <p className="text-gray-900 dark:text-white">{selectedGrant.vested_shares.toLocaleString()}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Unvested Shares</h4>
                    <p className="text-gray-900 dark:text-white">{selectedGrant.unvested_shares.toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Vested Value</h4>
                    <p className="text-green-600 dark:text-green-400">${selectedGrant.vested_value.toLocaleString()}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Value</h4>
                    <p className="text-gray-900 dark:text-white">${selectedGrant.total_value.toLocaleString()}</p>
                  </div>
                </div>
                {selectedGrant.current_price && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Current Price</h4>
                    <p className="text-gray-900 dark:text-white">${selectedGrant.current_price.toFixed(2)}</p>
                  </div>
                )}
                {selectedGrant.grant_type === 'stock_options' && selectedGrant.strike_price && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Strike Price</h4>
                    <p className="text-gray-900 dark:text-white">${selectedGrant.strike_price.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedGrant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Equity Grant
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
                Are you sure you want to delete this equity grant ({selectedGrant.company_symbol} - {selectedGrant.grant_type.toUpperCase()})? This action cannot be undone.
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

export default Equity