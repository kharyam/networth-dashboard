import { useState, useEffect } from 'react'
import { 
  Plus, 
  RefreshCw, 
  BarChart3, 
  Grid3X3, 
  List,
  Home,
  AlertTriangle,
  X
} from 'lucide-react'
import { realEstateApi, pluginsApi } from '../services/api'
import { RealEstate as RealEstateType, ManualEntrySchema } from '../types'
import PropertyCard from '../components/PropertyCard'
import PropertyCharts from '../components/PropertyCharts'
import SmartDynamicForm from '../components/SmartDynamicForm'
import { propertyValuationService } from '../services/propertyValuationService'

type ViewMode = 'grid' | 'list' | 'charts'

function RealEstate() {
  const [properties, setProperties] = useState<RealEstateType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null)
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<RealEstateType | null>(null)
  
  // Form states
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadProperties()
    loadSchema()
    checkFeatureStatus()
  }, [])

  const checkFeatureStatus = async () => {
    try {
      const enabled = await propertyValuationService.isFeatureEnabled()
      setFeatureEnabled(enabled)
      console.log('🔧 [RealEstate] Property valuation feature status:', enabled)
    } catch (error) {
      console.error('❌ [RealEstate] Failed to check feature status:', error)
      setFeatureEnabled(false)
    }
  }

  const loadProperties = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await realEstateApi.getAll()
      setProperties(data)
    } catch (err) {
      console.error('Failed to load properties:', err)
      setError('Failed to load properties. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadSchema = async () => {
    try {
      const realEstateSchema = await pluginsApi.getSchema('real_estate')
      setSchema(realEstateSchema)
    } catch (error) {
      console.error('Failed to load real estate schema:', error)
    }
  }

  const handleAddProperty = async (formData: Record<string, any>) => {
    setSubmitting(true)
    setMessage(null)

    try {
      await pluginsApi.processManualEntry('real_estate', formData)
      setMessage({ type: 'success', text: 'Property added successfully!' })
      
      // Refresh properties list
      await loadProperties()
      setAddModalOpen(false)
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to add property:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add property. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditProperty = (property: RealEstateType) => {
    setSelectedProperty(property)
    setEditModalOpen(true)
  }

  const handleUpdateProperty = async (formData: Record<string, any>) => {
    if (!selectedProperty) return

    setSubmitting(true)
    setMessage(null)

    try {
      await realEstateApi.update(selectedProperty.id, formData)
      setMessage({ type: 'success', text: 'Property updated successfully!' })
      
      // Refresh properties list and close modal
      await loadProperties()
      closeModals()
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to update property:', error)
      const errorMessage = error.response?.data?.error || 'Failed to update property. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewProperty = (property: RealEstateType) => {
    setSelectedProperty(property)
    setViewModalOpen(true)
  }

  const handleDeleteProperty = (property: RealEstateType) => {
    setSelectedProperty(property)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedProperty) return

    try {
      await realEstateApi.delete(selectedProperty.id)
      await loadProperties()
      closeModals()
    } catch (err) {
      console.error('Failed to delete property:', err)
      setError('Failed to delete property. Please try again.')
    }
  }

  const handleValueRefresh = async (property: RealEstateType, newValue: number) => {
    // For now, just update the local state since manual provider returns same value
    // In future, this would update the property with new API-provided value
    setProperties(prev => prev.map(p => 
      p.id === property.id 
        ? { ...p, current_value: newValue }
        : p
    ))
  }

  const handleRefreshAll = async () => {
    // Check if feature is enabled
    if (featureEnabled === false) {
      setError('Property valuation feature is currently disabled')
      setTimeout(() => setError(null), 5000)
      return
    }

    setRefreshing(true)
    try {
      // Refresh all property values
      const refreshPromises = properties.map(async (property) => {
        if (property.property_name) {
          try {
            const valuation = await propertyValuationService.refreshPropertyValueLegacy(
              property.property_name,
              property.current_value
            )
            return { ...property, current_value: valuation.estimated_value }
          } catch (error) {
            console.error(`Failed to refresh ${property.property_name}:`, error)
            return property
          }
        }
        return property
      })

      const refreshedProperties = await Promise.all(refreshPromises)
      setProperties(refreshedProperties)
    } catch (error) {
      console.error('Failed to refresh property values:', error)
      setError('Failed to refresh some property values.')
    } finally {
      setRefreshing(false)
    }
  }

  const closeModals = () => {
    setAddModalOpen(false)
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedProperty(null)
  }

  // Helper to convert property data to form format
  const propertyToFormData = (property: RealEstateType): Record<string, any> => {
    return {
      property_type: property.property_type,
      property_name: property.property_name,
      street_address: property.street_address || '',
      city: property.city || '',
      state: property.state || '',
      zip_code: property.zip_code || '',
      purchase_price: property.purchase_price,
      current_value: property.current_value,
      outstanding_mortgage: property.outstanding_mortgage || 0,
      purchase_date: property.purchase_date || '',
      // For optional numeric fields, preserve null values instead of converting to empty strings
      property_size_sqft: property.property_size_sqft,
      lot_size_acres: property.lot_size_acres,
      rental_income_monthly: property.rental_income_monthly,
      property_tax_annual: property.property_tax_annual,
      notes: property.notes || ''
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate portfolio summary
  const portfolioSummary = {
    totalValue: properties.reduce((sum, p) => sum + p.current_value, 0),
    totalEquity: properties.reduce((sum, p) => sum + (p.current_value - (p.outstanding_mortgage || 0)), 0),
    totalMortgage: properties.reduce((sum, p) => sum + (p.outstanding_mortgage || 0), 0),
    count: properties.length
  }

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Real Estate Portfolio</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your property holdings and track equity performance
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
                viewMode === 'grid'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('charts')}
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
            onClick={handleRefreshAll}
            disabled={refreshing || properties.length === 0 || featureEnabled === false}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            title={featureEnabled === false ? "Property valuation feature is disabled" : "Refresh property values using external APIs"}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Values'}
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Property
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`card border-l-4 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
        }`}>
          <p className={`${
            message.type === 'success' 
              ? 'text-green-700 dark:text-green-300' 
              : 'text-red-700 dark:text-red-300'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      {properties.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Portfolio Value</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(portfolioSummary.totalValue)}
            </p>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Equity</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(portfolioSummary.totalEquity)}
            </p>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Debt</h3>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(portfolioSummary.totalMortgage)}
            </p>
          </div>
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Properties</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {portfolioSummary.count}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'charts' ? (
        <PropertyCharts properties={properties} />
      ) : properties.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No properties found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by adding your first property to track its value and equity.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Property
          </button>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onEdit={handleEditProperty}
              onDelete={handleDeleteProperty}
              onView={handleViewProperty}
              onValueRefresh={handleValueRefresh}
            />
          ))}
        </div>
      )}

      {/* Add Property Modal */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add New Property
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
                onSubmit={handleAddProperty}
                loading={submitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Property Modal */}
      {viewModalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Property Details
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
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Property Name</h4>
                  <p className="text-gray-900 dark:text-white">{selectedProperty.property_name}</p>
                </div>
                {(selectedProperty.street_address || selectedProperty.city || selectedProperty.state || selectedProperty.zip_code) && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</h4>
                    <div className="text-gray-900 dark:text-white">
                      {selectedProperty.street_address && <p>{selectedProperty.street_address}</p>}
                      {(selectedProperty.city || selectedProperty.state || selectedProperty.zip_code) && (
                        <p>
                          {[selectedProperty.city, selectedProperty.state, selectedProperty.zip_code]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Value</h4>
                  <p className="text-gray-900 dark:text-white">{formatCurrency(selectedProperty.current_value)}</p>
                </div>
                {selectedProperty.purchase_price && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Purchase Price</h4>
                    <p className="text-gray-900 dark:text-white">{formatCurrency(selectedProperty.purchase_price)}</p>
                  </div>
                )}
                {selectedProperty.outstanding_mortgage && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Mortgage Balance</h4>
                    <p className="text-gray-900 dark:text-white">{formatCurrency(selectedProperty.outstanding_mortgage)}</p>
                  </div>
                )}
                {selectedProperty.api_estimated_value && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">API Estimated Value</h4>
                    <p className="text-gray-900 dark:text-white">
                      {formatCurrency(selectedProperty.api_estimated_value)}
                      {selectedProperty.api_provider && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          (from {selectedProperty.api_provider})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</h4>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedProperty.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Property
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
                Are you sure you want to delete "{selectedProperty.property_name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {editModalOpen && selectedProperty && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Edit Property
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {schema.name}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {schema.description}
              </p>
              
              <SmartDynamicForm
                schema={schema}
                initialData={propertyToFormData(selectedProperty)}
                onSubmit={handleUpdateProperty}
                loading={submitting}
                submitText="Update Property"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RealEstate