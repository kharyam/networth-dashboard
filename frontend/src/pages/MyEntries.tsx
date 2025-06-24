import { useState, useEffect } from 'react'
import { manualEntriesApi } from '../services/api'

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
                    <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      View
                    </button>
                    <button className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                      Edit
                    </button>
                    <button className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyEntries