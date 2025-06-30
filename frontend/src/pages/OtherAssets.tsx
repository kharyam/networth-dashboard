import { Package, Eye, Edit2, Trash2, TrendingUp, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import GenericAssetPage, { GenericAssetPageConfig } from '@/components/GenericAssetPage'
import { otherAssetsApi, pluginsApi } from '@/services/api'
import { formatCurrency, formatDate } from '@/utils/formatting'


interface OtherAsset {
  id: number
  asset_name: string
  current_value: number
  purchase_price?: number
  amount_owed?: number
  equity: number
  purchase_date?: string
  description?: string
  notes?: string
  custom_fields?: Record<string, any>
  valuation_method: string
  created_at: string
  last_updated: string
  asset_category_id: number
  category?: {
    name: string
    description: string
    icon: string
    color: string
  }
}

interface AssetsSummary {
  total_count: number
  total_value: number
  total_equity: number
}

// Transform API response data
const transformOtherAssetsData = (rawData: any): { assets: OtherAsset[], summary: AssetsSummary } => {
  if (!rawData) {
    return { 
      assets: [], 
      summary: { total_count: 0, total_value: 0, total_equity: 0 } 
    }
  }
  
  const assets = Array.isArray(rawData.other_assets) ? rawData.other_assets : []
  const summary = rawData.summary || { total_count: 0, total_value: 0, total_equity: 0 }
  
  return { 
    assets: assets.map((asset: any) => ({
      ...asset,
      current_value: parseFloat(asset.current_value) || 0,
      purchase_price: asset.purchase_price ? parseFloat(asset.purchase_price) : undefined,
      amount_owed: asset.amount_owed ? parseFloat(asset.amount_owed) : undefined,
      equity: parseFloat(asset.equity) || 0,
    })), 
    summary 
  }
}

const getIconForCategory = (icon?: string): string => {
  switch (icon) {
    case 'car': return '🚗'
    case 'gem': return '💎'
    case 'palette': return '🎨'
    case 'briefcase': return '💼'
    case 'lightbulb': return '💡'
    default: return '📦'
  }
}

// Custom other asset card renderer
const OtherAssetCard = (
  asset: OtherAsset,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
): JSX.Element => (
  <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">
          {getIconForCategory(asset.category?.icon)}
        </div>
        <div className="ml-3">
          <h3 className="font-medium text-gray-900 dark:text-white">{asset.asset_name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{asset.category?.name || 'Uncategorized'}</p>
        </div>
      </div>
      <div className="flex space-x-1">
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

    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">Current Value</span>
        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(asset.current_value)}</span>
      </div>
      {asset.amount_owed && asset.amount_owed > 0 && (
        <div className="flex justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Amount Owed</span>
          <span className="font-medium text-red-600 dark:text-red-400">-{formatCurrency(asset.amount_owed)}</span>
        </div>
      )}
      <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Equity</span>
        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(asset.equity)}</span>
      </div>
    </div>

    {asset.purchase_date && (
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Purchased: {formatDate(asset.purchase_date)}
        </span>
      </div>
    )}
  </div>
)

// Custom list row renderer for OtherAssets
const OtherAssetListRow = (
  asset: OtherAsset,
  actions: { onEdit: () => void, onView: () => void, onDelete: () => void }
): JSX.Element => (
  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
    <td className="px-6 py-4 whitespace-nowrap">
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm">
          {getIconForCategory(asset.category?.icon)}
        </div>
        <div className="ml-3">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{asset.asset_name}</div>
          {asset.purchase_date && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Purchased: {formatDate(asset.purchase_date)}
            </div>
          )}
        </div>
      </div>
    </td>
    <td className="px-6 py-4 whitespace-nowrap">
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        {asset.category?.name || 'Uncategorized'}
      </span>
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
      {formatCurrency(asset.current_value)}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
      {asset.amount_owed ? formatCurrency(asset.amount_owed) : '-'}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
      {formatCurrency(asset.equity)}
    </td>
    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
      <div className="flex space-x-2">
        <button
          onClick={actions.onView}
          className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={actions.onEdit}
          className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={actions.onDelete}
          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </td>
  </tr>
)

const OtherAssetListHeaders = (): JSX.Element => (
  <tr>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Asset</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Value</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount Owed</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Equity</th>
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
  </tr>
)

// Summary cards renderer with data from API response
const OtherAssetSummaryCards = (_assets: OtherAsset[], rawData?: any): JSX.Element => {
  const summary = rawData?.summary || { total_count: 0, total_value: 0, total_equity: 0 }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
            <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Assets</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_count}</p>
          </div>
        </div>
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
            <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary.total_value)}</p>
          </div>
        </div>
      </div>

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
            <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Equity</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(summary.total_equity)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Chart view component for OtherAssets
const OtherAssetCharts = (assets: OtherAsset[]): JSX.Element => {
  const categoryTotals = new Map<string, { value: number, equity: number, color: string }>()
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280']
  
  assets.forEach(asset => {
    const categoryName = asset.category?.name || 'Uncategorized'
    const categoryColor = asset.category?.color || '#6B7280'
    const existing = categoryTotals.get(categoryName) || { value: 0, equity: 0, color: categoryColor }
    existing.value += asset.current_value
    existing.equity += asset.equity
    categoryTotals.set(categoryName, existing)
  })

  const chartData = Array.from(categoryTotals.entries()).map(([name, data], index) => ({
    name,
    value: data.value,
    equity: data.equity,
    color: data.color || COLORS[index % COLORS.length],
  }))

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No data available for charts</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie Chart */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Assets by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Bar Chart */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Value vs Equity by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" name="Total Value" />
            <Bar dataKey="equity" fill="#10B981" name="Net Equity" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


// Configuration for the generic page
const otherAssetsConfig: GenericAssetPageConfig<OtherAsset> = {
  // API configuration
  fetchAll: otherAssetsApi.getAll,
  create: async (asset: any) => {
    const response = await pluginsApi.processManualEntry('other_assets', asset)
    return response.data || response as any
  },
  update: otherAssetsApi.update,
  delete: otherAssetsApi.delete,
  fetchSchema: () => pluginsApi.getSchema('other_assets'),
  transformData: (rawData: any) => transformOtherAssetsData(rawData).assets,
  
  // Page configuration
  title: 'Other Assets',
  description: 'Manage vehicles, collectibles, and other miscellaneous assets',
  icon: Package,
  entityName: 'Asset',
  
  // Rendering configuration
  renderCard: OtherAssetCard,
  renderListRow: OtherAssetListRow,
  renderListHeaders: OtherAssetListHeaders,
  renderSummaryCards: (assets, rawData) => OtherAssetSummaryCards(assets, rawData),
  renderCharts: OtherAssetCharts,
  
  // Feature configuration
  supportedViewModes: ['grid', 'list', 'charts'],
  enableAdd: true,
  enableRefresh: true,
  
  // Modal configuration
  entryType: 'other_assets',
  getFormData: (asset) => ({
    asset_name: asset.asset_name,
    current_value: asset.current_value,
    purchase_price: asset.purchase_price || null,
    amount_owed: asset.amount_owed || null,
    purchase_date: asset.purchase_date || '',
    description: asset.description || '',
    notes: asset.notes || '',
    asset_category_id: asset.asset_category_id,
    valuation_method: asset.valuation_method || 'manual',
    custom_fields: asset.custom_fields || {}
  })
}

function OtherAssets() {
  return <GenericAssetPage config={otherAssetsConfig} />
}

export default OtherAssets