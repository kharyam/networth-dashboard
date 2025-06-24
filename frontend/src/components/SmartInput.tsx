import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, Search, Clock, Building, AlertTriangle } from 'lucide-react'
import { smartDataService, SmartSuggestion } from '../services/smartDataService'

interface SmartInputProps {
  value: string
  onChange: (value: string) => void
  fieldName: string
  entryType: string
  placeholder?: string
  className?: string
  required?: boolean
  type?: 'text' | 'number'
  onCompanyNameSuggestion?: (companyName: string) => void
}

export function SmartInput({
  value,
  onChange,
  fieldName,
  entryType,
  placeholder,
  className = '',
  required = false,
  type = 'text',
  onCompanyNameSuggestion
}: SmartInputProps) {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([])
  const debounceRef = useRef<number>()

  // Memoize the search function to avoid recreation on every render
  const searchSuggestions = useMemo(() => {
    return async (searchValue: string) => {
      if (searchValue.length < 1) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const results = await smartDataService.getSuggestions(fieldName, searchValue, entryType)
        setSuggestions(results)
      } catch (error) {
        console.error('Failed to get suggestions:', error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }
  }, [fieldName, entryType])

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      if (showSuggestions) {
        searchSuggestions(value)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [value, showSuggestions, searchSuggestions])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setSelectedIndex(-1)
    
    if (newValue.length >= 1 && !showSuggestions) {
      setShowSuggestions(true)
    }
  }

  const handleInputFocus = () => {
    if (value.length >= 1) {
      setShowSuggestions(true)
      searchSuggestions(value)
    }
  }

  const handleInputBlur = (e: React.FocusEvent) => {
    // Delay hiding suggestions to allow for click events on suggestions
    setTimeout(() => {
      if (!e.relatedTarget?.closest('.suggestions-container')) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }, 150)
  }

  const selectSuggestion = (suggestion: SmartSuggestion) => {
    onChange(suggestion.value)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    
    // Auto-fill company name if available
    if (suggestion.metadata?.companyName && onCompanyNameSuggestion) {
      onCompanyNameSuggestion(suggestion.metadata.companyName)
    }
    
    // Store as recent value
    smartDataService.addRecentValue(fieldName, suggestion.value)
    
    // Focus back to input
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault()
          selectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionRefs.current[selectedIndex]) {
      suggestionRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  const getSuggestionIcon = (type: SmartSuggestion['type']) => {
    switch (type) {
      case 'symbol':
        return <Building className="w-4 h-4 text-blue-500" />
      case 'recent':
        return <Clock className="w-4 h-4 text-gray-500" />
      case 'duplicate':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default:
        return <Search className="w-4 h-4 text-gray-500" />
    }
  }

  const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 
    border-gray-300 dark:border-gray-600 focus:border-blue-500
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${className}`

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={baseClasses}
          autoComplete="off"
        />
        
        {(showSuggestions || isLoading) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-container absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.value}-${index}`}
              ref={el => suggestionRefs.current[index] = el}
              className={`flex items-center px-3 py-2 cursor-pointer transition-colors
                ${index === selectedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                }
                ${index === suggestions.length - 1 ? '' : 'border-b border-gray-200 dark:border-gray-700'}
              `}
              onClick={() => selectSuggestion(suggestion)}
            >
              <div className="flex-shrink-0 mr-3">
                {getSuggestionIcon(suggestion.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {suggestion.label}
                </div>
                {suggestion.type === 'symbol' && suggestion.metadata?.companyName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Will auto-fill company name
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SmartInput