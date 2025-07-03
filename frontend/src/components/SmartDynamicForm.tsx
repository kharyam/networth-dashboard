import { useState, useCallback, useEffect, useRef } from 'react'
import { ManualEntrySchema, ManualEntryField } from '../types'
import SmartInput from './SmartInput'
import SmartValidation from './SmartValidation'
import { smartDataService } from '../services/smartDataService'

interface SmartDynamicFormProps {
  schema: ManualEntrySchema
  onSubmit: (data: Record<string, any>) => void
  loading?: boolean
  initialData?: Record<string, any>
  submitText?: string
  onChange?: (fieldName: string, value: any, formData: Record<string, any>) => void
  onSchemaChange?: (categoryId: number) => Promise<void>
}

export function SmartDynamicForm({ schema, onSubmit, loading = false, initialData = {}, submitText = 'Submit', onChange, onSchemaChange }: SmartDynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const initializedRef = useRef<string | false>(false)

  // Initialize smart data service
  useEffect(() => {
    smartDataService.initialize()
  }, [])

  // Initialize form data when schema or initialData changes (but only once per modal open)
  useEffect(() => {
    if (!schema || !schema.fields) {
      initializedRef.current = false
      return
    }
    
    // Only initialize if not already done or if schema/initialData fundamentally changed
    const dataKey = JSON.stringify({ schema: schema.name, initialData })
    const shouldInitialize = !initializedRef.current || initializedRef.current !== dataKey
    
    if (shouldInitialize) {
      const defaultData: Record<string, any> = {}
      schema.fields.forEach(field => {
        if (field.default_value !== undefined) {
          defaultData[field.name] = field.default_value
        }
      })
      
      // Merge with initial data, converting null values to empty strings for form inputs
      const mergedData = { ...defaultData, ...initialData }
      
      // Convert null values to empty strings for form display, but keep track of original null state
      Object.keys(mergedData).forEach(key => {
        const field = schema.fields.find(f => f.name === key)
        if (field && field.type === 'number' && mergedData[key] === null) {
          mergedData[key] = ''
        }
      })
      
      setFormData(mergedData)
      initializedRef.current = dataKey
    }
  }, [initialData, schema])

  const handleInputChange = useCallback((fieldName: string, value: any) => {
    const newFormData = {
      ...formData,
      [fieldName]: value
    }
    
    setFormData(newFormData)
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }

    // Store recent value for future suggestions
    if (typeof value === 'string' && value.length > 0) {
      smartDataService.addRecentValue(fieldName, value)
    }
    
    // Call onChange callback if provided
    if (onChange) {
      onChange(fieldName, value, newFormData)
    }
    
    // Handle asset category change for dynamic schema loading
    if (fieldName === 'asset_category_id' && value && onSchemaChange) {
      const categoryId = parseInt(value.toString())
      if (categoryId > 0) {
        onSchemaChange(categoryId).catch(err => {
          console.error('Failed to load schema for category:', err)
        })
      }
    }
  }, [errors, formData, onChange])

  const handleCompanyNameSuggestion = useCallback((companyName: string) => {
    // Auto-fill company_name field when symbol is selected
    const companyNameField = schema.fields.find(f => f.name === 'company_name')
    if (companyNameField && !formData.company_name) {
      handleInputChange('company_name', companyName)
    }
  }, [formData.company_name, handleInputChange, schema.fields])

  const validateField = (field: ManualEntryField, value: any): string | null => {
    // For optional fields, null and empty string should be treated as valid "no value"
    const isEmptyValue = value === null || value === '' || value === undefined
    
    if (field.required && isEmptyValue) {
      return `${field.label} is required`
    }

    // Skip validation for empty optional fields
    if (!field.required && isEmptyValue) {
      return null
    }

    if (field.validation) {
      // Handle regex pattern validation
      if (field.validation.pattern && value) {
        const regex = new RegExp(field.validation.pattern)
        if (!regex.test(value)) {
          return `${field.label} format is invalid`
        }
      }

      // Handle min/max validation for numbers
      if (field.type === 'number' && !isEmptyValue) {
        const numValue = parseFloat(value)
        if (isNaN(numValue)) {
          return `${field.label} must be a valid number`
        }
        if (field.validation.min !== undefined && numValue < field.validation.min) {
          return `${field.label} must be at least ${field.validation.min}`
        }
        if (field.validation.max !== undefined && numValue > field.validation.max) {
          return `${field.label} must be at most ${field.validation.max}`
        }
      }

      // Handle string length validation
      if (typeof value === 'string' && value !== '') {
        if (field.validation.min_length !== undefined && value.length < field.validation.min_length) {
          return `${field.label} must be at least ${field.validation.min_length} characters`
        }
        if (field.validation.max_length !== undefined && value.length > field.validation.max_length) {
          return `${field.label} must be at most ${field.validation.max_length} characters`
        }
      }
    }

    return null
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    schema.fields.forEach(field => {
      const error = validateField(field, formData[field.name])
      if (error) {
        newErrors[field.name] = error
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (validateForm()) {
      // Normalize form data before submission
      const normalizedData = { ...formData }
      
      // Convert empty strings to null for optional numeric fields
      schema.fields.forEach(field => {
        if (field.type === 'number' && !field.required && normalizedData[field.name] === '') {
          normalizedData[field.name] = null
        }
      })
      
      onSubmit(normalizedData)
    }
  }

  const shouldUseSmartInput = (field: ManualEntryField): boolean => {
    // Use smart input for text fields that could benefit from suggestions
    if (field.type !== 'text') return false
    
    const smartFields = [
      'symbol', 
      'company_name', 
      'company_symbol',
      'property_name',
      'institution',
      'grant_type'
    ]
    
    return smartFields.includes(field.name)
  }

  const getEntryType = (): string => {
    // Try to determine from schema name first
    if (schema.name) {
      if (schema.name.toLowerCase().includes('stock')) return 'stock_holding'
      if (schema.name.toLowerCase().includes('morgan')) return 'morgan_stanley'
      if (schema.name.toLowerCase().includes('real')) return 'real_estate'
    }
    
    // Try to determine from plugin name or fields
    const hasSymbol = schema.fields.some(f => f.name === 'symbol')
    const hasGrantType = schema.fields.some(f => f.name === 'grant_type')
    const hasPropertyType = schema.fields.some(f => f.name === 'property_type')
    
    if (hasSymbol) return 'stock_holding'
    if (hasGrantType) return 'morgan_stanley'
    if (hasPropertyType) return 'real_estate'
    
    return 'unknown'
  }

  const renderField = (field: ManualEntryField) => {
    const fieldId = `field-${field.name}`
    const value = formData[field.name] !== undefined ? formData[field.name] : ''
    const error = errors[field.name]
    const entryType = getEntryType()

    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 
      ${error 
        ? 'border-red-500 focus:border-red-500' 
        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
      } 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white`

    // Use SmartInput for eligible fields
    if (shouldUseSmartInput(field)) {
      return (
        <SmartInput
          value={value}
          onChange={(newValue) => handleInputChange(field.name, newValue)}
          fieldName={field.name}
          entryType={entryType}
          placeholder={field.placeholder}
          className={error ? 'border-red-500 focus:border-red-500' : ''}
          required={field.required}
          onCompanyNameSuggestion={field.name === 'symbol' || field.name === 'company_symbol' ? handleCompanyNameSuggestion : undefined}
        />
      )
    }

    // Regular form fields for non-smart inputs
    switch (field.type) {
      case 'number':
        return (
          <input
            id={fieldId}
            type="number"
            className={baseClasses}
            placeholder={field.placeholder}
            value={value}
            step="any"
            onChange={(e) => handleInputChange(field.name, e.target.value ? parseFloat(e.target.value) : '')}
            required={field.required}
          />
        )

      case 'date':
        return (
          <input
            id={fieldId}
            type="date"
            className={baseClasses}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          />
        )

      case 'select':
        return (
          <select
            id={fieldId}
            className={baseClasses}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )

      case 'checkbox':
        return (
          <div className="flex items-center">
            <input
              id={fieldId}
              type="checkbox"
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              checked={value || false}
              onChange={(e) => handleInputChange(field.name, e.target.checked)}
            />
            <label htmlFor={fieldId} className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
              {field.label}
            </label>
          </div>
        )

      case 'textarea':
        return (
          <textarea
            id={fieldId}
            className={`${baseClasses} h-24 resize-vertical`}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          />
        )

      default:
        return (
          <input
            id={fieldId}
            type="text"
            className={baseClasses}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          />
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {schema.fields.map(field => (
        <div key={field.name} className="space-y-2">
          {field.type !== 'checkbox' && (
            <label 
              htmlFor={`field-${field.name}`}
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          )}
          
          {field.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {field.description}
            </p>
          )}
          
          {renderField(field)}
          
          {errors[field.name] && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors[field.name]}
            </p>
          )}
        </div>
      ))}

      {/* Smart Validation Component */}
      <SmartValidation 
        formData={formData} 
        entryType={getEntryType()} 
      />

      <div className="flex justify-end space-x-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : submitText}
        </button>
      </div>
    </form>
  )
}

export default SmartDynamicForm