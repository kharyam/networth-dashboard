import { useState, useEffect } from 'react'
import { AlertTriangle, Info, TrendingUp, Calculator } from 'lucide-react'
import { smartDataService, ValidationResult } from '../services/smartDataService'

interface SmartValidationProps {
  formData: Record<string, any>
  entryType: string
  className?: string
}

export function SmartValidation({ formData, entryType, className = '' }: SmartValidationProps) {
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, warnings: [], suggestions: [] })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const validateData = async () => {
      // Only validate if we have meaningful data
      const hasData = Object.values(formData).some(value => 
        value !== null && value !== undefined && value !== ''
      )
      
      if (!hasData) {
        setValidation({ isValid: true, warnings: [], suggestions: [] })
        return
      }

      setIsLoading(true)
      try {
        const result = await smartDataService.validateEntry(formData, entryType)
        setValidation(result)
      } catch (error) {
        console.error('Validation error:', error)
        setValidation({ isValid: true, warnings: [], suggestions: [] })
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce validation
    const timeoutId = setTimeout(validateData, 500)
    return () => clearTimeout(timeoutId)
  }, [formData, entryType])

  if (isLoading) {
    return (
      <div className={`p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
          Validating entry...
        </div>
      </div>
    )
  }

  if (validation.warnings.length === 0 && validation.suggestions.length === 0) {
    return null
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5 mr-2" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                Potential Issues
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions and Insights */}
      {validation.suggestions.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start">
            {validation.suggestions.some(s => s.includes('value') || s.includes('gain') || s.includes('loss')) ? (
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2" />
            ) : validation.suggestions.some(s => s.includes('equity') || s.includes('appreciation')) ? (
              <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2" />
            )}
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                Smart Insights
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                {validation.suggestions.map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SmartValidation