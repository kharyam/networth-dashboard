import { useState, useEffect } from 'react'
import { manualEntriesApi } from '../services/api'
import { X, Eye, Edit2, Trash2 } from 'lucide-react'

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

function MyEntries() {
  const [entries, setEntries] = useState<ManualEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [selectedEntry, setSelectedEntry] = useState<ManualEntry | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  useEffect(() => {
    loadEntries()
  }, [filter])

  const loadEntries = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await manualEntriesApi.getAll()
      setEntries(response)
    } catch (err) {
      console.error('Failed to load manual entries:', err)
      setError('Failed to load manual entries. Please try again.')
    } finally {
      setLoading(false)
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
      case 'computershare':
        return `${data.symbol || 'Stock'} - ${data.shares_owned || 0} shares`
      case 'morgan_stanley':
        return `${data.company_symbol || 'Equity'} ${data.grant_type || 'Grant'} - ${data.total_shares || 0} shares`
      case 'real_estate':
        return data.property_name || 'Real Estate Property'
      default:
        return `${entry.entry_type} Entry`
    }
  }

  const getEntryValue = (entry: ManualEntry) => {
    const data = parseDataJson(entry.data_json)
    
    switch (entry.entry_type) {
      case 'computershare':
        if (data.shares_owned && data.current_price) {
          return `$${(data.shares_owned * data.current_price).toLocaleString()}`
        }
        return 'N/A'
      case 'real_estate':
        if (data.current_value) {
          return `$${data.current_value.toLocaleString()}`
        }
        return 'N/A'
      default:
        return 'N/A'
    }
  }

  const filteredEntries = entries.filter(entry => 
    filter === '' || entry.entry_type === filter
  )

  const entryTypes = [...new Set(entries.map(e => e.entry_type))]

  const openViewModal = (entry: ManualEntry) => {
    setSelectedEntry(entry)
    setViewModalOpen(true)
  }

  const openEditModal = (entry: ManualEntry) => {
    setSelectedEntry(entry)
    setEditModalOpen(true)
  }

  const openDeleteModal = (entry: ManualEntry) => {
    setSelectedEntry(entry)
    setDeleteModalOpen(true)
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
      await loadEntries() // Refresh the list
      closeModals()
    } catch (err) {
      console.error('Failed to delete entry:', err)
      setError('Failed to delete entry. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Manual Entries</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading entries...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Manual Entries</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and manage all your manually entered financial data
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Filter and Stats */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Entries: {filteredEntries.length}
            </span>
            {entryTypes.length > 1 && (
              <div className="flex items-center space-x-2">
                <label htmlFor="filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter:
                </label>
                <select
                  id="filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm"
                >
                  <option value="">All Types</option>
                  {entryTypes.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <button
            onClick={loadEntries}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            {filter ? 
              `No ${filter.replace('_', ' ')} entries found.` : 
              'No manual entries found. Start by adding some data!'
            }
          </div>
          <a
            href="/manual-entry"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Manual Entry
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {getEntryTitle(entry)}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {entry.entry_type.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {entry.institution && (
                      <span>{entry.institution} • </span>
                    )}
                    Added {formatDate(entry.created_at)}
                    {entry.updated_at !== entry.created_at && (
                      <span> • Updated {formatDate(entry.updated_at)}</span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {getEntryValue(entry)}
                  </div>
                  <div className="mt-1 space-x-2">
                    <button 
                      onClick={() => openViewModal(entry)}
                      className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </button>
                    <button 
                      onClick={() => openEditModal(entry)}
                      className="inline-flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </button>
                    <button 
                      onClick={() => openDeleteModal(entry)}
                      className="inline-flex items-center px-2 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeModals}>
              <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
            </div>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    View {selectedEntry.entry_type.replace('_', ' ').toUpperCase()} Entry
                  </h3>
                  <button
                    onClick={closeModals}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entry Type</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedEntry.entry_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedEntry.account_name || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Institution</label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedEntry.institution || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Details</label>
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded border text-sm">
                      <pre className="whitespace-pre-wrap text-gray-900 dark:text-white">
                        {JSON.stringify(parseDataJson(selectedEntry.data_json), null, 2)}
                      </pre>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Created</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedEntry.created_at)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(selectedEntry.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={closeModals}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeModals}>
              <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
            </div>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Delete Manual Entry
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete this {selectedEntry.entry_type.replace('_', ' ')} entry? 
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleDelete}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={closeModals}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - TODO: Implement in next phase */}
      {editModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeModals}>
              <div className="absolute inset-0 bg-gray-500 opacity-75 dark:bg-gray-900"></div>
            </div>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Edit functionality coming soon!
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Edit functionality will be implemented in the next phase.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={closeModals}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyEntries