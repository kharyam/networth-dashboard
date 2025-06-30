/**
 * Shared validation utilities to eliminate duplication across components
 */

/**
 * Check if a value is a valid number
 */
export const isValidNumber = (value: any): boolean => {
  return !isNaN(value) && !isNaN(parseFloat(value)) && isFinite(value)
}

/**
 * Check if a string is empty or only whitespace
 */
export const isEmpty = (value: string | null | undefined): boolean => {
  return !value || value.trim().length === 0
}

/**
 * Check if a value is null or undefined
 */
export const isNullOrUndefined = (value: any): boolean => {
  return value === null || value === undefined
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate positive number (greater than 0)
 */
export const isPositiveNumber = (value: any): boolean => {
  return isValidNumber(value) && parseFloat(value) > 0
}

/**
 * Validate non-negative number (greater than or equal to 0)
 */
export const isNonNegativeNumber = (value: any): boolean => {
  return isValidNumber(value) && parseFloat(value) >= 0
}

/**
 * Validate percentage (0-100)
 */
export const isValidPercentage = (value: any): boolean => {
  if (!isValidNumber(value)) return false
  const num = parseFloat(value)
  return num >= 0 && num <= 100
}

/**
 * Validate date string
 */
export const isValidDate = (dateString: string): boolean => {
  if (isEmpty(dateString)) return false
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * Validate that date is not in the future
 */
export const isNotFutureDate = (dateString: string): boolean => {
  if (!isValidDate(dateString)) return false
  const date = new Date(dateString)
  const now = new Date()
  return date <= now
}

/**
 * Validate string length
 */
export const isValidLength = (value: string, min: number, max?: number): boolean => {
  if (isEmpty(value)) return false
  const length = value.trim().length
  if (length < min) return false
  if (max && length > max) return false
  return true
}

/**
 * Validate stock symbol format (1-5 uppercase letters)
 */
export const isValidStockSymbol = (symbol: string): boolean => {
  if (isEmpty(symbol)) return false
  const symbolRegex = /^[A-Z]{1,5}$/
  return symbolRegex.test(symbol.trim().toUpperCase())
}

/**
 * Validate currency code (3 uppercase letters)
 */
export const isValidCurrencyCode = (code: string): boolean => {
  if (isEmpty(code)) return false
  const currencyRegex = /^[A-Z]{3}$/
  return currencyRegex.test(code.trim().toUpperCase())
}

/**
 * Validate account number (basic format check)
 */
export const isValidAccountNumber = (accountNumber: string): boolean => {
  if (isEmpty(accountNumber)) return false
  // Allow alphanumeric and common separators
  const accountRegex = /^[A-Z0-9\-_]{4,20}$/i
  return accountRegex.test(accountNumber.trim())
}

/**
 * Sanitize numeric input (remove non-numeric characters except decimal point)
 */
export const sanitizeNumericInput = (value: string): string => {
  return value.replace(/[^0-9.-]/g, '')
}

/**
 * Sanitize string input (trim and limit length)
 */
export const sanitizeStringInput = (value: string, maxLength: number = 255): string => {
  return value.trim().substring(0, maxLength)
}

/**
 * Parse and validate numeric field
 */
export const parseNumericField = (value: any, fieldName: string): number | null => {
  if (isNullOrUndefined(value) || value === '') {
    return null
  }
  
  const sanitized = typeof value === 'string' ? sanitizeNumericInput(value) : value
  
  if (!isValidNumber(sanitized)) {
    throw new Error(`${fieldName} must be a valid number`)
  }
  
  return parseFloat(sanitized)
}

/**
 * Validate required field
 */
export const validateRequired = (value: any, fieldName: string): void => {
  if (isNullOrUndefined(value) || (typeof value === 'string' && isEmpty(value))) {
    throw new Error(`${fieldName} is required`)
  }
}

/**
 * Validate field with custom validator
 */
export const validateField = <T>(
  value: T,
  fieldName: string,
  validator: (value: T) => boolean,
  errorMessage?: string
): void => {
  if (!validator(value)) {
    throw new Error(errorMessage || `${fieldName} is invalid`)
  }
}

/**
 * Validation error collection utility
 */
export class ValidationErrors {
  private errors: Record<string, string[]> = {}

  add(field: string, error: string): void {
    if (!this.errors[field]) {
      this.errors[field] = []
    }
    this.errors[field].push(error)
  }

  addRequired(field: string): void {
    this.add(field, `${field} is required`)
  }

  addInvalid(field: string, message?: string): void {
    this.add(field, message || `${field} is invalid`)
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0
  }

  getErrors(): Record<string, string[]> {
    return this.errors
  }

  getFirstError(): string | null {
    const firstField = Object.keys(this.errors)[0]
    if (!firstField) return null
    return this.errors[firstField][0]
  }

  clear(): void {
    this.errors = {}
  }
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  // Financial values should be positive numbers with max 2 decimal places
  price: (value: any) => {
    if (!isValidNumber(value)) return false
    const num = parseFloat(value)
    return num > 0 && /^\d+(\.\d{1,2})?$/.test(value.toString())
  },

  // Shares should be positive integers or decimals
  shares: (value: any) => {
    if (!isValidNumber(value)) return false
    return parseFloat(value) > 0
  },

  // Percentage should be 0-100 with max 2 decimal places
  percentage: (value: any) => {
    if (!isValidNumber(value)) return false
    const num = parseFloat(value)
    return num >= 0 && num <= 100 && /^\d+(\.\d{1,2})?$/.test(value.toString())
  }
}