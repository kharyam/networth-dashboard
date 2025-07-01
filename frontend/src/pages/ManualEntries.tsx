import { useState, useEffect } from 'react'
import { FileText, Plus, List, RefreshCw, Eye, Edit2, Trash2, X, AlertTriangle } from 'lucide-react'
import { manualEntriesApi, pluginsApi } from '@/services/api'
import { Plugin, ManualEntrySchema } from '@/types'
import SmartDynamicForm from '@/components/SmartDynamicForm'
import EditEntryModal from '@/components/EditEntryModal'

interface ManualEntry {
  id: number
  account_id: number
  entry_type: string
  data_json: string
  created_at: string
  updated_at: string
  account_name?: string
  institution?: string
}

interface EntriesSummary {
  total_count: number
  by_type: Record<string, number>
  recent_count: number
}

type TabType = 'add' | 'view'

// Transform API response data
const transformManualEntriesData = (rawData: any): { entries: ManualEntry[], summary: EntriesSummary } => {
  if (!rawData) {
    return { 
      entries: [], 
      summary: { total_count: 0, by_type: {}, recent_count: 0 } 
    }
  }
  
  // Handle both array response and wrapped response
  const entriesArray = Array.isArray(rawData) ? rawData : (rawData.entries || [])
  
  // Enhanced duplicate removal with robust uniqueness check
  const uniqueEntries = entriesArray.filter((entry: any, index: number, arr: any[]) => {
    if (!entry || !entry.id || !entry.entry_type) {
      return false
    }
    
    const entryKey = `${entry.entry_type}-${entry.id}-${entry.account_id}-${entry.created_at}`
    const firstOccurrenceIndex = arr.findIndex((e: any) => {
      const otherKey = `${e.entry_type}-${e.id}-${e.account_id}-${e.created_at}`
      return otherKey === entryKey
    })
    
    return firstOccurrenceIndex === index
  })
  
  // Calculate summary
  const byType = uniqueEntries.reduce((acc: Record<string, number>, entry: ManualEntry) => {
    acc[entry.entry_type] = (acc[entry.entry_type] || 0) + 1
    return acc
  }, {})
  
  const recentCount = uniqueEntries.filter((entry: ManualEntry) => {
    const entryDate = new Date(entry.created_at)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return entryDate >= weekAgo
  }).length
  
  return {
    entries: uniqueEntries,
    summary: {
      total_count: uniqueEntries.length,
      by_type: byType,
      recent_count: recentCount
    }
  }
}

const parseDataJson = (dataJson: string) => {
  try {
    return JSON.parse(dataJson)
  } catch {
    return {}
  }
}

const getIconForEntryType = (entryType: string): string => {
  switch (entryType) {
    case 'stock_holding': return '📈'
    case 'morgan_stanley': return '🏛️'
    case 'real_estate': return '🏠'
    case 'cash_holdings': return '💰'
    case 'crypto_holdings': return '₿'
    case 'other_assets': return '📦'
    default: return '📄'
  }
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

const getEntryTitle = (entry: ManualEntry) => {
  const data = parseDataJson(entry.data_json)
  
  switch (entry.entry_type) {
    case 'stock_holding':
      return `${data.symbol || 'Stock'} at ${data.institution_name || 'Institution'} - ${data.shares_owned || 0} shares`
    case 'morgan_stanley':
      return `${data.company_symbol || 'Equity'} ${data.grant_type || 'Grant'}`
    case 'real_estate':
      return data.property_name || 'Real Estate Property'
    case 'cash_holdings':
      return `${data.institution_name || 'Bank'} - ${data.account_name || 'Account'} (${data.account_type || 'Cash'})`
    case 'crypto_holdings':
      return `${data.institution_name || 'Exchange'} - ${data.crypto_symbol || 'Crypto'} (${data.balance_tokens || 0} tokens)`
    case 'other_assets':
      return data.asset_name || `${data.category_name || 'Other'} Asset`
    default:
      return `${entry.entry_type} Entry`
  }
}

const getEntryValue = (entry: ManualEntry) => {
  const data = parseDataJson(entry.data_json)
  
  switch (entry.entry_type) {
    case 'stock_holding':
      if (data.shares_owned && data.current_price) {
        return `$${(data.shares_owned * data.current_price).toLocaleString()}`
      }
      return 'N/A'
    case 'morgan_stanley':
      if (data.vested_shares && data.current_price) {
        if (data.grant_type === 'stock_option' && data.strike_price) {
          const intrinsicValue = Math.max(0, data.current_price - data.strike_price)
          const totalValue = data.vested_shares * intrinsicValue
          return totalValue > 0 ? `$${totalValue.toLocaleString()}` : '$0'
        } else {
          const totalValue = data.vested_shares * data.current_price
          return `$${totalValue.toLocaleString()}`
        }
      }
      return 'N/A'
    case 'real_estate':
      if (data.current_value) {
        return `$${data.current_value.toLocaleString()}`
      }
      return 'N/A'
    case 'cash_holdings':
      if (data.current_balance) {
        const currency = data.currency || 'USD'
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency
        }).format(data.current_balance)
      }
      return 'N/A'
    case 'crypto_holdings':
      if (data.current_value_usd) {
        return `$${data.current_value_usd.toLocaleString()}`
      } else if (data.balance_tokens && data.current_price_usd) {
        const value = data.balance_tokens * data.current_price_usd
        return `$${value.toLocaleString()}`
      }
      return `${data.balance_tokens || 0} ${data.crypto_symbol || 'tokens'}`
    case 'other_assets':
      if (data.current_value) {
        const netValue = data.current_value - (data.amount_owed || 0)
        return `$${netValue.toLocaleString()}`
      }
      return 'N/A'
    default:
      return 'N/A'
  }
}

function ManualEntries() {
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>('view')
  
  // Add Entry state
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [selectedPlugin, setSelectedPlugin] = useState<string>('')
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // View Entries state
  const [entries, setEntries] = useState<ManualEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<ManualEntry | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  
  // Filter state
  const [filterType, setFilterType] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState<string>('')

  useEffect(() => {
    loadPlugins()
    loadEntries()
  }, [])

  // Add Entry functions
  const loadPlugins = async () => {
    try {
      const pluginList = await pluginsApi.getAll()
      const manualEntryPlugins = pluginList.filter(p => p.type === 'manual' && p.enabled)
      setPlugins(manualEntryPlugins)
    } catch (error) {
      console.error('Failed to load plugins:', error)
      setMessage({ type: 'error', text: 'Failed to load plugins. Please try again.' })
    }
  }

  const handlePluginSelect = async (pluginName: string) => {
    setSelectedPlugin(pluginName)
    setMessage(null)
    
    if (!pluginName) {
      setSchema(null)
      return
    }

    try {
      const pluginSchema = await pluginsApi.getSchema(pluginName)
      setSchema(pluginSchema)
    } catch (error) {
      console.error('Failed to load schema:', error)
      setMessage({ type: 'error', text: 'Failed to load entry form. Please try again.' })
    }
  }

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!selectedPlugin) return

    setSubmitting(true)
    setMessage(null)

    try {
      await pluginsApi.processManualEntry(selectedPlugin, formData)
      setMessage({ type: 'success', text: 'Entry added successfully!' })
      
      // Reset form
      setSelectedPlugin('')
      setSchema(null)
      
      // Refresh entries list and switch to view tab
      await loadEntries()
      setActiveTab('view')
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to submit entry:', error)
      const errorMessage = error.response?.data?.error || 'Failed to add entry. Please try again.'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  // View Entries functions
  const loadEntries = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await manualEntriesApi.getAll()
      const { entries } = transformManualEntriesData(response)
      setEntries(entries)
    } catch (err) {
      console.error('Failed to load manual entries:', err)
      setError('Failed to load manual entries. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const refreshEntries = async () => {
    try {
      setRefreshing(true)
      setError(null)
      const response = await manualEntriesApi.getAll()
      const { entries } = transformManualEntriesData(response)
      setEntries(entries)
    } catch (err) {
      console.error('Failed to refresh manual entries:', err)
      setError('Failed to refresh manual entries. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  const closeModals = () => {
    setViewModalOpen(false)
    setEditModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedEntry(null)
  }

  const handleDelete = async () => {
    if (!selectedEntry) return
    
    try {
      await manualEntriesApi.delete(selectedEntry.id, selectedEntry.entry_type)
      await loadEntries()
      closeModals()
      setMessage({ type: 'success', text: 'Entry deleted successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete entry:', err)
      setError('Failed to delete entry. Please try again.')
    }
  }

  const handleEntryUpdate = async (updatedData: Record<string, any>) => {
    if (!selectedEntry) return
    
    try {
      await manualEntriesApi.update(selectedEntry.id, selectedEntry.entry_type, updatedData)
      await loadEntries()
      closeModals()
      setMessage({ type: 'success', text: 'Entry updated successfully!' })
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      console.error('Failed to update entry:', err)
      const errorMessage = err.response?.data?.error || 'Failed to update entry. Please try again.'
      setError(errorMessage)
    }
  }

  const clearMessage = () => {
    setMessage(null)
  }

  const clearError = () => {
    setError(null)
  }

  // Filter entries based on search term and type filter
  const filteredEntries = entries.filter(entry => {
    const matchesType = !filterType || entry.entry_type === filterType
    const matchesSearch = !searchTerm || 
      getEntryTitle(entry).toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.entry_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.institution && entry.institution.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesType && matchesSearch
  })

  // Calculate summary from filtered entries
  const { summary } = transformManualEntriesData(filteredEntries)
  
  // Get unique entry types for filter dropdown
  const entryTypes = [...new Set(entries.map(entry => entry.entry_type))].sort()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <FileText className="w-8 h-8 mr-3 text-primary-600" />
            Manual Entries
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Add new entries and manage your existing manual data
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Refresh Button */}
          <button
            onClick={refreshEntries}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
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
          <div className="flex items-center justify-between">
            <p className={`${
              message.type === 'success' 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </p>
            <button onClick={clearMessage} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={clearError} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('view')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'view'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <List className="w-4 h-4 inline mr-2" />
            View Entries ({summary.total_count})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'add'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add New Entry
          </button>
        </nav>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_count}</p>
            </div>
          </div>
        </div>

        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <List className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Entry Types</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{Object.keys(summary.by_type).length}</p>
            </div>
          </div>
        </div>

        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
              <Plus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent (7 days)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.recent_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'view' && (
        <div className="space-y-6">
          {/* Filter Controls */}
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filter Entries</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  id="search"
                  placeholder="Search entries by title, type, or institution..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Entry Type
                </label>
                <select
                  id="filter-type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Types</option>
                  {entryTypes.map(type => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(searchTerm || filterType) && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredEntries.length} of {entries.length} entries
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterType('')
                  }}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Entries List */}
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No entries found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Get started by adding your first manual entry.
              </p>
              <button
                onClick={() => setActiveTab('add')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Entry
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEntries.map((entry) => (
                <div key={`${entry.entry_type}-${entry.id}`} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg">
                        {getIconForEntryType(entry.entry_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {getEntryTitle(entry)}
                          </h3>
                          <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {getEntryValue(entry)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {entry.entry_type}
                          </span>
                          {entry.institution && <span>{entry.institution}</span>}
                          <span>•</span>
                          <span>{formatDate(entry.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEntry(entry)
                          setViewModalOpen(true)
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEntry(entry)
                          setEditModalOpen(true)
                        }}
                        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEntry(entry)
                          setDeleteModalOpen(true)
                        }}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-6">
          {/* Plugin Selection */}
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Choose Entry Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plugins.map((plugin) => (
                <button
                  key={plugin.name}
                  onClick={() => handlePluginSelect(plugin.name)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedPlugin === plugin.name
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {plugin.friendly_name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {plugin.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Form */}
          {schema && (
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {schema.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {schema.description}
              </p>
              
              <SmartDynamicForm
                schema={schema}
                onSubmit={handleFormSubmit}
                loading={submitting}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {/* View Modal */}
      {viewModalOpen && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Entry Details
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
                {JSON.stringify(parseDataJson(selectedEntry.data_json), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditEntryModal
        entryType={selectedEntry?.entry_type || ''}
        entryData={selectedEntry?.data_json || '{}'}
        title="Edit Entry"
        isOpen={editModalOpen && !!selectedEntry}
        onClose={closeModals}
        onUpdate={handleEntryUpdate}
        submitText="Update Entry"
      />

      {/* Delete Modal */}
      {deleteModalOpen && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete Entry
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
                Are you sure you want to delete "{getEntryTitle(selectedEntry)}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
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

export default ManualEntries