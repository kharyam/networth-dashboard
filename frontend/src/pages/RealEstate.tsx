import { Home, Eye, Edit2, Trash2 } from 'lucide-react'
import GenericAssetPage, { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { realEstateApi, pluginsApi } from '@/services/api'
import { RealEstate as RealEstateType } from '@/types'
import PropertyCard from '@/components/PropertyCard'
import PropertyCharts from '@/components/PropertyCharts'
import { formatCurrency, formatDate } from '@/utils/formatting'

interface RealEstateSummary {
  totalValue: number
  totalEquity: number
  totalMortgage: number
  count: number
}

// Transform API response data  
const transformRealEstateData = (rawData: any): { properties: RealEstateType[], summary: RealEstateSummary } => {
  if (!rawData) {
    return { 
      properties: [], 
      summary: { totalValue: 0, totalEquity: 0, totalMortgage: 0, count: 0 } 
    }
  }
  
  const properties = Array.isArray(rawData) ? rawData : (rawData.properties || rawData || [])
  
  const summary = {
    totalValue: properties.reduce((sum: number, p: RealEstateType) => sum + p.current_value, 0),
    totalEquity: properties.reduce((sum: number, p: RealEstateType) => sum + (p.current_value - (p.outstanding_mortgage || 0)), 0),
    totalMortgage: properties.reduce((sum: number, p: RealEstateType) => sum + (p.outstanding_mortgage || 0), 0),
    count: properties.length
  }
  
  return { properties, summary }
}

// Enhanced PropertyCard wrapper for GenericAssetPage
const RealEstateCard = (
  property: RealEstateType,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
): JSX.Element => {
  // Value refresh handler - placeholder for now since we need access to propertyValuationService
  const handleValueRefresh = async (prop: RealEstateType, newValue: number) => {
    // For now, this is a placeholder. In the full implementation, this would:
    // 1. Call propertyValuationService.refreshPropertyValueLegacy()
    // 2. Update the property value via API
    // 3. Refresh the properties list
    console.log(`Would refresh ${prop.property_name} to ${newValue}`)
  }

  return (
    <PropertyCard
      property={property}
      onEdit={actions.onEdit}
      onDelete={actions.onDelete}
      onView={actions.onView}
      onValueRefresh={handleValueRefresh}
    />
  )
}

// Summary cards renderer
const RealEstateSummaryCards = (properties: RealEstateType[], rawData?: any): JSX.Element => {
  const { summary } = transformRealEstateData(rawData)
  
  // Calculate total appreciation
  const totalPurchasePrice = properties.reduce((sum, p) => sum + (p.purchase_price || 0), 0)
  const totalAppreciation = summary.totalValue - totalPurchasePrice
  const appreciationPercentage = totalPurchasePrice > 0 ? (totalAppreciation / totalPurchasePrice) * 100 : 0
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Portfolio Value</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(summary.totalValue)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Equity</h3>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatCurrency(summary.totalEquity)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Appreciation</h3>
        <p className={`text-2xl font-bold ${
          totalAppreciation >= 0 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {formatCurrency(totalAppreciation)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {appreciationPercentage > 0 ? '+' : ''}
          {appreciationPercentage.toFixed(1)}% growth
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Debt</h3>
        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
          {formatCurrency(summary.totalMortgage)}
        </p>
      </div>
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Properties</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {summary.count}
        </p>
      </div>
    </div>
  )
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

// Custom list item renderer for simple list view
const RealEstateListItem = (
  property: RealEstateType,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
): JSX.Element => {
  const equity = property.current_value - (property.outstanding_mortgage || 0)
  const equityPercentage = property.current_value > 0 ? (equity / property.current_value) * 100 : 0
  
  // Build address string
  const address = [property.street_address, property.city, property.state]
    .filter(Boolean)
    .join(', ') || 'Address not specified'
  
  return (
    <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {property.property_name || 'Unnamed Property'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatPropertyType(property.property_type)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(property.current_value)}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                {formatCurrency(equity)} equity ({equityPercentage.toFixed(1)}%)
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Location:</span>
              <div className="text-gray-900 dark:text-white">{address}</div>
            </div>
            
            {property.outstanding_mortgage && property.outstanding_mortgage > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Mortgage:</span>
                <div className="text-orange-600 dark:text-orange-400">
                  {formatCurrency(property.outstanding_mortgage)}
                </div>
              </div>
            )}
            
            {property.purchase_date && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Purchased:</span>
                <div className="text-gray-900 dark:text-white">
                  {formatDate(property.purchase_date)}
                </div>
              </div>
            )}
            
            {property.rental_income_monthly && property.rental_income_monthly > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Monthly Rent:</span>
                <div className="text-green-600 dark:text-green-400">
                  {formatCurrency(property.rental_income_monthly)}
                </div>
              </div>
            )}
            
            {property.property_size_sqft && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Size:</span>
                <div className="text-gray-900 dark:text-white">
                  {property.property_size_sqft.toLocaleString()} sq ft
                </div>
              </div>
            )}
            
            {property.property_tax_annual && property.property_tax_annual > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Annual Tax:</span>
                <div className="text-gray-900 dark:text-white">
                  {formatCurrency(property.property_tax_annual)}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2 ml-4">
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
    </div>
  )
}

// Helper function to format property type for display
const formatPropertyType = (type: string): string => {
  if (!type) return 'Unknown Type'
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Custom table headers for detailed list view
const RealEstateListHeaders = (): JSX.Element => (
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Property
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Type & Location
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Current Value
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Mortgage
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Equity
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Purchase Date
    </th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
      Actions
    </th>
  </tr>
)

// Custom table row for detailed list view
const RealEstateListRow = (
  property: RealEstateType,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
): JSX.Element => {
  const equity = property.current_value - (property.outstanding_mortgage || 0)
  const equityPercentage = property.current_value > 0 ? (equity / property.current_value) * 100 : 0
  
  // Build address string
  const address = [property.city, property.state]
    .filter(Boolean)
    .join(', ') || 'Location not specified'
  
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {property.property_name || 'Unnamed Property'}
          </div>
          {property.street_address && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {property.street_address}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm text-gray-900 dark:text-white">
            {formatPropertyType(property.property_type)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {address}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {formatCurrency(property.current_value)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {property.outstanding_mortgage && property.outstanding_mortgage > 0 ? (
          <span className="text-orange-600 dark:text-orange-400">
            {formatCurrency(property.outstanding_mortgage)}
          </span>
        ) : (
          <span className="text-gray-400">None</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-green-600 dark:text-green-400">
            {formatCurrency(equity)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {equityPercentage.toFixed(1)}%
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {property.purchase_date ? formatDate(property.purchase_date) : 'Not specified'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <div className="flex space-x-2">
          <button
            onClick={actions.onView}
            className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={actions.onEdit}
            className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={actions.onDelete}
            className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// Configuration for the generic page
const realEstateConfig: GenericAssetPageConfig<RealEstateType> = {
  // API configuration
  fetchAll: realEstateApi.getAll,
  create: async (propertyData: any) => {
    const response = await pluginsApi.processManualEntry('real_estate', propertyData)
    return response.data || response as any
  },
  update: realEstateApi.update,
  delete: realEstateApi.delete,
  fetchSchema: () => pluginsApi.getSchema('real_estate'),
  transformData: (rawData: any) => transformRealEstateData(rawData).properties,
  
  // Page configuration
  title: 'Real Estate Portfolio',
  description: 'Manage your property holdings and track equity performance',
  icon: Home,
  entityName: 'Property',
  
  // Rendering configuration
  renderCard: RealEstateCard,
  renderListItem: RealEstateListItem,
  renderListHeaders: RealEstateListHeaders,
  renderListRow: RealEstateListRow,
  renderSummaryCards: (properties, rawData) => RealEstateSummaryCards(properties, rawData),
  renderCharts: (properties: RealEstateType[]) => <PropertyCharts properties={properties} />,
  
  // Feature configuration
  supportedViewModes: ['grid', 'list', 'charts'],
  enableAdd: true,
  enableRefresh: true,
  
  // Modal configuration
  entryType: 'real_estate',
  getFormData: propertyToFormData
}

function RealEstate() {
  return <GenericAssetPage config={realEstateConfig} />
}

export default RealEstate