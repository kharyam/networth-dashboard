import { useState, useEffect } from 'react'
import { Plus, List, X, Eye, Edit2, Trash2, Filter } from 'lucide-react'
import { pluginsApi, manualEntriesApi } from '../services/api'
import { Plugin, ManualEntrySchema } from '../types'
import SmartDynamicForm from '../components/SmartDynamicForm'
import EditEntryModal from '../components/EditEntryModal'

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

type TabType = 'add' | 'view'

function ManualEntries() {
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>('view')
  
  // Add Entry state (from ManualEntry.tsx)
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [selectedPlugin, setSelectedPlugin] = useState<string>('')
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // View Entries state (from MyEntries.tsx)
  const [entries, setEntries] = useState<ManualEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<ManualEntry | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

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
    // Prevent multiple simultaneous calls
    if (isLoadingEntries) {
      console.log('Already loading entries, skipping...')
      return
    }
    
    try {
      setIsLoadingEntries(true)
      setLoading(true)
      setError(null)
      
      console.log('Loading entries from API...')
      const response = await manualEntriesApi.getAll()
      console.log('Raw API response:', response)
      console.log('Response is array:', Array.isArray(response))
      console.log('Response length:', response?.length || 'no length')
      
      // Ensure response is an array
      const entriesArray = Array.isArray(response) ? response : []
      console.log('Entries array length:', entriesArray.length)
      
      // Log first few entries to see their structure
      if (entriesArray.length > 0) {
        console.log('Sample entries:', entriesArray.slice(0, 3))
        console.log('All entry IDs and types:', entriesArray.map(e => ({ id: e.id, type: e.entry_type })))
      }
      
      // Enhanced duplicate removal with more robust uniqueness check
      const uniqueEntries = entriesArray.filter((entry, index, arr) => {
        if (!entry || !entry.id || !entry.entry_type) {
          console.warn('Invalid entry found:', entry)
          return false
        }
        
        // Create a unique key combining multiple fields for better deduplication
        const entryKey = `${entry.entry_type}-${entry.id}-${entry.account_id}-${entry.created_at}`
        const firstOccurrenceIndex = arr.findIndex(e => {
          const otherKey = `${e.entry_type}-${e.id}-${e.account_id}-${e.created_at}`
          return otherKey === entryKey
        })
        
        const isUnique = firstOccurrenceIndex === index
        if (!isUnique) {
          console.log('Removing duplicate:', { entry, index, firstOccurrenceIndex })
        }
        
        return isUnique
      })
      
      console.log('Unique entries after filtering:', uniqueEntries.length)
      console.log('Final unique entries:', uniqueEntries.map(e => ({ 
        id: e.id, 
        type: e.entry_type, 
        account_id: e.account_id,
        created_at: e.created_at 
      })))
      
      setEntries(uniqueEntries)
    } catch (err) {
      console.error('Failed to load manual entries:', err)
      setError('Failed to load manual entries. Please try again.')
    } finally {
      setLoading(false)
      setIsLoadingEntries(false)
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

  const parseDataJson = (dataJson: string) => {
    try {
      return JSON.parse(dataJson)
    } catch {
      return {}
    }
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
            // For options: calculate intrinsic value
            const intrinsicValue = Math.max(0, data.current_price - data.strike_price)
            const totalValue = data.vested_shares * intrinsicValue
            return totalValue > 0 ? `$${totalValue.toLocaleString()}` : '$0'
          } else {
            // For RSUs/ESPP: simple market value
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

  // Enhanced filtering debug function
  const debugFilterEntries = () => {
    console.group('🔍 Manual Entries Filter Debug')
    console.log('Filter state:', { filter, filterLength: filter.length })
    console.log('Entries data:', {
      totalEntries: entries.length,
      entryTypes: [...new Set(entries.map(e => e.entry_type))],
      sampleEntry: entries[0] ? {
        id: entries[0].id,
        type: entries[0].entry_type,
        dataKeys: Object.keys(parseDataJson(entries[0].data_json))
      } : null
    })
    console.groupEnd()
  }

  // Get filtered entries - simple and reliable approach with debugging
  const getFilteredEntries = () => {
    console.log('🔍 getFilteredEntries called with filter:', filter)
    console.log('📊 Total entries to filter:', entries.length)
    
    if (!filter || filter.trim() === '') {
      console.log('✅ No filter applied, returning all entries:', entries.length)
      return entries
    }
    
    const filterLower = filter.toLowerCase().trim()
    console.log('🎯 Applying filter:', filterLower)
    
    const filtered = entries.filter(entry => {
      try {
        const data = parseDataJson(entry.data_json)
        
        // Simple search in common fields
        const searchableText = [
          entry.entry_type || '',
          data.institution_name || '',
          data.symbol || '',
          data.company_symbol || '',
          data.crypto_symbol || '',
          data.property_name || '',
          data.account_name || '',
          data.grant_type || ''
        ].join(' ').toLowerCase()
        
        const matches = searchableText.includes(filterLower)
        if (matches) {
          console.log('Entry matches filter:', {
            id: entry.id,
            type: entry.entry_type,
            searchableText,
            filter: filterLower
          })
        }
        
        return matches
      } catch (e) {
        console.error('Error filtering entry:', entry, e)
        return false
      }
    })
    
    console.log('Filtered results:', filtered.length, 'entries')
    return filtered
  }
  
  const filteredEntries = getFilteredEntries()

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manual Entries</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Add new entries and manage your existing manual data
        </p>
      </div>

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
            View Entries ({entries.length})
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

      {/* Tab Content */}
      {activeTab === 'view' && (
        <div className="space-y-6">
          {/* Filter and Actions */}
          <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter entries..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {filter && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredEntries.length} of {entries.length} entries
                  </span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={debugFilterEntries}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  title="Debug filter functionality (check console)"
                >
                  🐛 Debug
                </button>
                <button
                  onClick={loadEntries}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Entries List */}
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={loadEntries}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Try Again
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {entries.length === 0 ? 'No entries found' : 'No matching entries'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {entries.length === 0 
                  ? 'Get started by adding your first manual entry.'
                  : 'Try adjusting your filter or add a new entry.'
                }
              </p>
              <button
                onClick={() => setActiveTab('add')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add Entry
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {(() => {
                console.log('Rendering entries - Total:', entries.length, 'Filtered:', filteredEntries.length)
                console.log('Entries being rendered:', filteredEntries.map(e => ({ id: e.id, type: e.entry_type })))
                return filteredEntries.map((entry) => (
                <div key={`${entry.entry_type}-${entry.id}`} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
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
                        <span>{entry.institution}</span>
                        <span>•</span>
                        <span>{formatDate(entry.created_at)}</span>
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
                ))
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-6">
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