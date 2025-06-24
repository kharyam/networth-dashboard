import { useState } from 'react'
import { ManualEntrySchema, ManualEntryField } from '../types'

interface DynamicFormProps {
  schema: ManualEntrySchema
  onSubmit: (data: Record<string, any>) => void
  loading?: boolean
  initialData?: Record<string, any>
}

export function DynamicForm({ schema, onSubmit, loading = false, initialData = {} }: DynamicFormProps) {
  // Initialize form data with default values from schema
  const getInitialFormData = () => {
    const defaultData: Record<string, any> = {}
    schema.fields.forEach(field => {
      if (field.default_value !== undefined) {
        defaultData[field.name] = field.default_value
      }
    })
    return { ...defaultData, ...initialData }
  }
  
  const [formData, setFormData] = useState<Record<string, any>>(() => getInitialFormData())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }))
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  const validateField = (field: ManualEntryField, value: any): string | null => {
    if (field.required && (!value || value === '')) {
      return `${field.label} is required`
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
      if (field.type === 'number' && value !== null && value !== '') {
        const numValue = parseFloat(value)
        if (field.validation.min !== undefined && numValue < field.validation.min) {
          return `${field.label} must be at least ${field.validation.min}`
        }
        if (field.validation.max !== undefined && numValue > field.validation.max) {
          return `${field.label} must be at most ${field.validation.max}`
        }
      }

      // Handle string length validation
      if (typeof value === 'string') {
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
      onSubmit(formData)
    }
  }

  const renderField = (field: ManualEntryField) => {
    const fieldId = `field-${field.name}`
    const value = formData[field.name] || ''
    const error = errors[field.name]

    const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 
      ${error 
        ? 'border-red-500 focus:border-red-500' 
        : 'border-gray-300 dark:border-gray-600 focus:border-blue-500'
      } 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white`

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <input
            id={fieldId}
            type={field.type}
            className={baseClasses}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
          />
        )

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

      <div className="flex justify-end space-x-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

export default DynamicForm