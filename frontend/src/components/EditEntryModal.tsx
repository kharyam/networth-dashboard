import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { pluginsApi } from '../services/api'
import { ManualEntrySchema } from '../types'
import SmartDynamicForm from './SmartDynamicForm'
import { flattenCustomFieldsFromParsedData, flattenCustomFields } from '../utils/customFields'

interface EditEntryModalProps {
  // Entry data (can be from any source)
  entryType: string
  entryData: Record<string, any> | string // JSON string or object
  categoryId?: number // For other_assets that need category-specific schema
  
  // Modal config
  title?: string
  isOpen: boolean
  onClose: () => void
  onUpdate: (data: Record<string, any>) => Promise<void>
  
  // Optional overrides
  submitText?: string
  schemaOverride?: ManualEntrySchema
}

export function EditEntryModal({ 
  entryType,
  entryData, 
  categoryId,
  title = "Edit Entry",
  isOpen,
  onClose, 
  onUpdate,
  submitText = "Update Entry",
  schemaOverride
}: EditEntryModalProps) {
  const [schema, setSchema] = useState<ManualEntrySchema | null>(schemaOverride || null)
  const [loading, setLoading] = useState(!schemaOverride)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (schemaOverride) {
      setSchema(schemaOverride)
      setLoading(false)
    } else if (isOpen) {
      loadSchema()
    }
  }, [entryType, categoryId, isOpen, schemaOverride])

  const loadSchema = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let pluginSchema: ManualEntrySchema
      
      // Handle other_assets with category-specific schema
      if (entryType === 'other_assets' && categoryId) {
        pluginSchema = await pluginsApi.getSchemaForCategory('other_assets', categoryId)
      } else {
        pluginSchema = await pluginsApi.getSchema(entryType)
      }
      
      setSchema(pluginSchema)
    } catch (err) {
      console.error('Failed to load schema:', err)
      setError('Failed to load entry form. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const parseEntryData = () => {
    try {
      // Handle both JSON string and object input
      const parsed = typeof entryData === 'string' ? JSON.parse(entryData) : entryData
      
      // For other_assets entries, flatten custom_fields to match schema field names
      if (entryType === 'other_assets') {
        // Check if data has nested custom_fields (from manual entries JSON)
        if (parsed.custom_fields && typeof parsed.custom_fields === 'object') {
          return flattenCustomFieldsFromParsedData(parsed)
        }
        // Or if it's a direct asset object, flatten the custom_fields property
        else if (parsed.custom_fields) {
          return {
            ...parsed,
            ...flattenCustomFields(parsed.custom_fields)
          }
        }
      }
      
      return parsed
    } catch {
      return {}
    }
  }

  const handleSubmit = async (formData: Record<string, any>) => {
    setSubmitting(true)
    setError(null)

    try {
      await onUpdate(formData)
    } catch (err: any) {
      console.error('Failed to update entry:', err)
      const errorMessage = err.response?.data?.error || 'Failed to update entry. Please try again.'
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          {error && (
            <div className="mb-4 card border-l-4 bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : schema ? (
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {schema.name}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {schema.description}
              </p>
              
              <SmartDynamicForm
                schema={schema}
                initialData={parseEntryData()}
                onSubmit={handleSubmit}
                loading={submitting}
                submitText={submitText}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Failed to load the entry form.
              </p>
              <button
                onClick={loadSchema}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditEntryModal