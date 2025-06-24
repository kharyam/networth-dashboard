import { useState } from 'react'
import { 
  Home, 
  Building, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  RefreshCw,
  Edit2,
  Trash2,
  Eye
} from 'lucide-react'
import { RealEstate } from '../types'
import { propertyValuationService } from '../services/propertyValuationService'

interface PropertyCardProps {
  property: RealEstate
  onEdit: (property: RealEstate) => void
  onDelete: (property: RealEstate) => void
  onView: (property: RealEstate) => void
  onValueRefresh?: (property: RealEstate, newValue: number) => void
}

function PropertyCard({ property, onEdit, onDelete, onView, onValueRefresh }: PropertyCardProps) {
  const [refreshing, setRefreshing] = useState(false)

  // Calculate derived values
  const equity = property.current_value - (property.outstanding_mortgage || 0)
  const equityPercentage = property.current_value > 0 
    ? Math.round((equity / property.current_value) * 100) 
    : 0

  // Calculate appreciation if purchase price is available
  const appreciation = property.purchase_price 
    ? property.current_value - property.purchase_price 
    : null
  const appreciationPercentage = property.purchase_price && property.purchase_price > 0
    ? Math.round((appreciation! / property.purchase_price) * 100)
    : null

  // Get property type icon
  const getPropertyIcon = () => {
    switch (property.property_type) {
      case 'primary_residence':
        return <Home className="w-5 h-5" />
      case 'investment_property':
      case 'commercial':
        return <Building className="w-5 h-5" />
      default:
        return <Home className="w-5 h-5" />
    }
  }

  // Get property type label
  const getPropertyTypeLabel = () => {
    switch (property.property_type) {
      case 'primary_residence':
        return 'Primary Residence'
      case 'investment_property':
        return 'Investment Property'
      case 'vacation_home':
        return 'Vacation Home'
      case 'commercial':
        return 'Commercial'
      case 'land':
        return 'Land/Lot'
      default:
        return 'Property'
    }
  }

  // Handle value refresh
  const handleRefreshValue = async () => {
    if (!property.property_name) return

    setRefreshing(true)
    try {
      const valuation = await propertyValuationService.refreshPropertyValue(
        property.property_name,
        property.current_value
      )
      
      // For now, manual provider returns the same value
      // In future, this could update with API-provided values
      if (onValueRefresh) {
        onValueRefresh(property, valuation.estimated_value)
      }
    } catch (error) {
      console.error('Failed to refresh property value:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      {/* Property Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900 rounded-lg">
            {getPropertyIcon()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {property.property_name || 'Unnamed Property'}
            </h3>
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {getPropertyTypeLabel()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshValue}
            disabled={refreshing || !property.property_name}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
            title="Refresh Property Value"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onView(property)}
            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(property)}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="Edit Property"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(property)}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete Property"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Value</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(property.current_value)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Equity</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(equity)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {equityPercentage}% of value
          </p>
        </div>
      </div>

      {/* Additional Details */}
      <div className="space-y-2">
        {property.outstanding_mortgage && property.outstanding_mortgage > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Mortgage Balance:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatCurrency(property.outstanding_mortgage)}
            </span>
          </div>
        )}

        {property.purchase_price && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Purchase Price:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatCurrency(property.purchase_price)}
            </span>
          </div>
        )}

        {appreciation !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Appreciation:</span>
            <div className={`flex items-center font-medium ${
              appreciation >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {appreciation >= 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" />
              )}
              {formatCurrency(Math.abs(appreciation))}
              {appreciationPercentage !== null && (
                <span className="ml-1">({appreciationPercentage > 0 ? '+' : ''}{appreciationPercentage}%)</span>
              )}
            </div>
          </div>
        )}

        {property.purchase_date && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Purchase Date:</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {formatDate(property.purchase_date)}
            </span>
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <Calendar className="w-3 h-3 mr-1" />
          Created {formatDate(property.created_at)}
        </div>
      </div>
    </div>
  )
}

export default PropertyCard