import { useState, useEffect } from 'react'
import { pluginsApi } from '../services/api'
import { Plugin, ManualEntrySchema } from '../types'
import DynamicForm from '../components/DynamicForm'

function ManualEntry() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [selectedPlugin, setSelectedPlugin] = useState<string>('')
  const [schema, setSchema] = useState<ManualEntrySchema | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadPlugins()
  }, [])

  const loadPlugins = async () => {
    try {
      setLoading(true)
      const pluginList = await pluginsApi.getAll()
      const manualEntryPlugins = pluginList.filter(p => p.type === 'manual')
      setPlugins(manualEntryPlugins)
    } catch (error) {
      console.error('Failed to load plugins:', error)
      setMessage({ type: 'error', text: 'Failed to load plugins. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handlePluginSelect = async (pluginName: string) => {
    if (!pluginName) {
      setSelectedPlugin('')
      setSchema(null)
      return
    }

    try {
      setLoading(true)
      setSelectedPlugin(pluginName)
      const pluginSchema = await pluginsApi.getSchema(pluginName)
      setSchema(pluginSchema)
      setMessage(null)
    } catch (error) {
      console.error('Failed to load plugin schema:', error)
      setMessage({ type: 'error', text: 'Failed to load plugin form. Please try again.' })
      setSelectedPlugin('')
      setSchema(null)
    } finally {
      setLoading(false)
    }
  }

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (!selectedPlugin) return

    try {
      setSubmitting(true)
      setMessage(null)
      
      const response = await pluginsApi.processManualEntry(selectedPlugin, formData)
      
      if (response.error) {
        setMessage({ type: 'error', text: response.error })
      } else {
        setMessage({ type: 'success', text: response.message || 'Entry saved successfully!' })
        // Reset form after successful submission
        setSelectedPlugin('')
        setSchema(null)
      }
    } catch (error) {
      console.error('Failed to submit form:', error)
      setMessage({ type: 'error', text: 'Failed to save entry. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const getPluginDisplayName = (pluginName: string) => {
    return pluginName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manual Entry</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manually enter and update your financial data
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400'
            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Data Source</h3>
        
        {loading && !schema && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        )}

        {!loading && plugins.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400">
            No manual entry plugins available. Please check your plugin configuration.
          </p>
        )}

        {plugins.length > 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="plugin-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Choose a data source to add entries:
              </label>
              <select
                id="plugin-select"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={selectedPlugin}
                onChange={(e) => handlePluginSelect(e.target.value)}
              >
                <option value="">Select a data source...</option>
                {plugins.map(plugin => (
                  <option key={plugin.name} value={plugin.name}>
                    {getPluginDisplayName(plugin.name)} ({plugin.type})
                  </option>
                ))}
              </select>
            </div>

            {selectedPlugin && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-400">
                  {getPluginDisplayName(selectedPlugin)}
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {selectedPlugin === 'computershare' && 'Enter your stock holdings from Computershare accounts'}
                  {selectedPlugin === 'morgan_stanley' && 'Enter your equity compensation from Morgan Stanley'}
                  {selectedPlugin === 'real_estate' && 'Enter your real estate property information'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {schema && (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {getPluginDisplayName(selectedPlugin)} Entry Form
          </h3>
          
          <DynamicForm
            schema={schema}
            onSubmit={handleFormSubmit}
            loading={submitting}
          />
        </div>
      )}
    </div>
  )
}

export default ManualEntry