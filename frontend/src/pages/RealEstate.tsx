import { Home } from 'lucide-react'
import GenericAssetPage, { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { realEstateApi, pluginsApi } from '@/services/api'
import { RealEstate as RealEstateType } from '@/types'
import PropertyCard from '@/components/PropertyCard'
import PropertyCharts from '@/components/PropertyCharts'
import { formatCurrency } from '@/utils/formatting'

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