import { useState, useEffect, useMemo } from 'react'
import { 
  Plus, 
  RefreshCw, 
  BarChart3, 
  Grid3X3, 
  List,
  Package,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  X,
  Filter,
  TrendingUp,
} from 'lucide-react'
import { 
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import { pluginsApi } from '../services/api'
import { ManualEntrySchema } from '../types'
import SmartDynamicForm from '../components/SmartDynamicForm'

interface AssetCategory {
  id: number
  name: string
  description?: string
  icon?: string
  color?: string
  custom_schema?: any
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

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

type ViewMode = 'grid' | 'list' | 'charts'

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280']

function OtherAssets() {
  const [assets, setAssets] = useState<OtherAsset[]>([])
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [summary, setSummary] = useState<AssetsSummary>({ total_count: 0, total_value: 0, total_equity: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<OtherAsset | null>(null)
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [currentFormCategoryId, setCurrentFormCategoryId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      loadAssets(),
      loadCategories()
    ])
  }, [])

  const loadAssets = async (categoryFilter?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const url = categoryFilter 
        ? `/api/v1/other-assets?category=${categoryFilter}`
        : '/api/v1/other-assets'
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      
      const data = await response.json()
      setAssets(data.other_assets || [])
      setSummary(data.summary || { total_count: 0, total_value: 0, total_equity: 0 })
    } catch (err) {
      console.error('Failed to load assets:', err)
      setError('Failed to load assets. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/v1/asset-categories?active=true')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }
      
      const data = await response.json()
      setCategories(data.asset_categories || [])
    } catch (err) {
      console.error('Failed to load categories:', err)
    }
  }

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId)
    loadAssets(categoryId || undefined)
  }

  const loadSchema = async (categoryId?: number) => {
    try {
      let pluginSchema: ManualEntrySchema
      
      if (categoryId) {
        // Load schema with custom fields for specific category
        pluginSchema = await pluginsApi.getSchemaForCategory('other_assets', categoryId)
      } else {
        // Load base schema
        pluginSchema = await pluginsApi.getSchema('other_assets')
      }
      
      setSchema(pluginSchema)
    } catch (error) {
      console.error('Failed to load schema:', error)
      setError('Failed to load entry form. Please try again.')
    }
  }

  const handleFormDataChange = async (fieldName: string, value: any) => {
    // If the asset category field changes, reload schema with custom fields
    if (fieldName === 'asset_category_id' && value && value !== currentFormCategoryId) {
      setCurrentFormCategoryId(value)
      await loadSchema(value)
    }
  }

  const handleAddAsset = async () => {
    setShowAddModal(true)
    setCurrentFormCategoryId(null)
    await loadSchema()
  }

  const handleFormSubmit = async (formData: Record<string, any>) => {
    try {
      setSubmitting(true)
      setError(null)

      await pluginsApi.processManualEntry('other_assets', formData)
      setMessage({ type: 'success', text: 'Asset added successfully!' })
      
      setShowAddModal(false)
      setSchema(null)
      await loadAssets(selectedCategory || undefined)
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to submit asset:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add asset. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewAsset = (asset: OtherAsset) => {
    setSelectedAsset(asset)
    setShowViewModal(true)
  }

  const handleEditAsset = async (asset: OtherAsset) => {
    setSelectedAsset(asset)
    setShowEditModal(true)
    setCurrentFormCategoryId(asset.asset_category_id)
    await loadSchema(asset.asset_category_id)
  }

  const handleUpdateAsset = async (formData: Record<string, any>) => {
    if (!selectedAsset) return

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(`/api/v1/other-assets/${selectedAsset.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update asset')
      }

      setMessage({ type: 'success', text: 'Asset updated successfully!' })
      setShowEditModal(false)
      setSelectedAsset(null)
      setSchema(null)
      await loadAssets(selectedCategory || undefined)
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to update asset:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAsset = (asset: OtherAsset) => {
    setSelectedAsset(asset)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!selectedAsset) return

    try {
      const response = await fetch(`/api/v1/other-assets/${selectedAsset.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete asset')
      }

      setMessage({ type: 'success', text: 'Asset deleted successfully!' })
      setShowDeleteModal(false)
      setSelectedAsset(null)
      await loadAssets(selectedCategory || undefined)
      
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to delete asset:', error)
      setMessage({ type: 'error', text: error.message })
    }
  }

  const chartData = useMemo(() => {
    const categoryTotals = new Map<string, { value: number, equity: number, color: string }>()
    
    assets.forEach(asset => {
      const categoryName = asset.category?.name || 'Uncategorized'
      const categoryColor = asset.category?.color || '#6B7280'
      const existing = categoryTotals.get(categoryName) || { value: 0, equity: 0, color: categoryColor }
      existing.value += asset.current_value
      existing.equity += asset.equity
      categoryTotals.set(categoryName, existing)
    })

    return Array.from(categoryTotals.entries()).map(([name, data]) => ({
      name,
      value: data.value,
      equity: data.equity,
      color: data.color,
    }))
  }, [assets])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getIconForCategory = (icon?: string) => {
    // Map icon names to actual icons - you can expand this
    switch (icon) {
      case 'car': return '🚗'
      case 'gem': return '💎'
      case 'palette': return '🎨'
      case 'briefcase': return '💼'
      case 'lightbulb': return '💡'
      default: return '📦'
    }
  }

  const closeModals = () => {
    setShowAddModal(false)
    setShowViewModal(false)
    setShowEditModal(false)
    setShowDeleteModal(false)
    setSelectedAsset(null)
    setSchema(null)
    setCurrentFormCategoryId(null)
    setMessage(null)
  }

  if (loading && assets.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Other Assets</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage vehicles, collectibles, and other miscellaneous assets
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => loadAssets(selectedCategory || undefined)}
            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleAddAsset}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
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

      {/* Summary Stats */}
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

      {/* Controls */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {assets.length} assets
              </span>
            )}
          </div>

          {/* View Mode Toggles */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Grid3X3 className="w-4 h-4 mr-1" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${
                viewMode === 'charts'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Charts
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => loadAssets(selectedCategory || undefined)}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {!error && assets.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No assets found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {selectedCategory 
              ? 'No assets found in this category. Try selecting a different category or add a new asset.'
              : 'Get started by adding your first asset to track its value and equity.'
            }
          </p>
          <button
            onClick={handleAddAsset}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add Asset
          </button>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assets.map((asset) => (
                <div key={asset.id} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
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
                        onClick={() => handleViewAsset(asset)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditAsset(asset)}
                        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset)}
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
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Asset</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount Owed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Equity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {assets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                              onClick={() => handleViewAsset(asset)}
                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditAsset(asset)}
                              className="text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset)}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Charts View */}
          {viewMode === 'charts' && chartData.length > 0 && (
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
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
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
          )}
        </>
      )}

      {/* Add Asset Modal */}
      {showAddModal && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Add New Asset</h3>
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
                onSubmit={handleFormSubmit}
                loading={submitting}
                onChange={handleFormDataChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Asset Modal */}
      {showViewModal && selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Asset Details</h3>
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
                  <h4 className="font-medium text-gray-900 dark:text-white">{selectedAsset.asset_name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedAsset.category?.name || 'Uncategorized'}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Value</label>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(selectedAsset.current_value)}</p>
                  </div>
                  {selectedAsset.purchase_price && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchase Price</label>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">{formatCurrency(selectedAsset.purchase_price)}</p>
                    </div>
                  )}
                  {selectedAsset.amount_owed && selectedAsset.amount_owed > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount Owed</label>
                      <p className="text-lg font-medium text-red-600 dark:text-red-400">{formatCurrency(selectedAsset.amount_owed)}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Net Equity</label>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(selectedAsset.equity)}</p>
                  </div>
                </div>

                {selectedAsset.purchase_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchase Date</label>
                    <p className="text-gray-900 dark:text-white">{formatDate(selectedAsset.purchase_date)}</p>
                  </div>
                )}

                {selectedAsset.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</label>
                    <p className="text-gray-900 dark:text-white">{selectedAsset.description}</p>
                  </div>
                )}

                {selectedAsset.custom_fields && Object.keys(selectedAsset.custom_fields).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Additional Details</label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(selectedAsset.custom_fields).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="text-sm text-gray-900 dark:text-white">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
                  Last updated: {formatDate(selectedAsset.last_updated)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {showEditModal && selectedAsset && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Edit Asset</h3>
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
                initialData={{
                  asset_category_id: selectedAsset.asset_category_id,
                  asset_name: selectedAsset.asset_name,
                  current_value: selectedAsset.current_value,
                  purchase_price: selectedAsset.purchase_price,
                  amount_owed: selectedAsset.amount_owed,
                  purchase_date: selectedAsset.purchase_date,
                  description: selectedAsset.description,
                  custom_fields: selectedAsset.custom_fields || {},
                }}
                onSubmit={handleUpdateAsset}
                loading={submitting}
                submitText="Update Asset"
                onChange={handleFormDataChange}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Asset Modal */}
      {showDeleteModal && selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Delete Asset</h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete "{selectedAsset.asset_name}"? This action cannot be undone.
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
    </div>
  )
}

export default OtherAssets