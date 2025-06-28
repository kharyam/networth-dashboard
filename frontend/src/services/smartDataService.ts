import { stocksApi, manualEntriesApi } from './api'

export interface SmartSuggestion {
  value: string
  label: string
  type: 'symbol' | 'company' | 'recent' | 'duplicate'
  metadata?: any
}

export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  suggestions: string[]
}

class SmartDataService {
  private stockSymbols: Set<string> = new Set()
  private companyNames: Map<string, string> = new Map() // symbol -> company name
  private recentValues: Map<string, string[]> = new Map() // field -> recent values
  private existingEntries: any[] = []
  private initialized = false

  async initialize() {
    if (this.initialized) return

    try {
      // Load existing stock holdings for auto-completion
      const [stocks, consolidatedStocks, manualEntries] = await Promise.all([
        stocksApi.getAll(),
        stocksApi.getConsolidated(),
        manualEntriesApi.getAll()
      ])

      // Build symbol and company name maps
      stocks.forEach(stock => {
        if (stock.symbol) {
          this.stockSymbols.add(stock.symbol.toUpperCase())
          if (stock.company_name) {
            this.companyNames.set(stock.symbol.toUpperCase(), stock.company_name)
          }
        }
      })

      consolidatedStocks.forEach(stock => {
        if (stock.symbol) {
          this.stockSymbols.add(stock.symbol.toUpperCase())
          if (stock.company_name) {
            this.companyNames.set(stock.symbol.toUpperCase(), stock.company_name)
          }
        }
      })

      // Store existing manual entries for duplicate detection
      this.existingEntries = manualEntries

      // Build recent values from existing entries
      this.buildRecentValues(manualEntries)

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize smart data service:', error)
    }
  }

  private buildRecentValues(entries: any[]) {
    entries.forEach(entry => {
      try {
        const data = JSON.parse(entry.data_json)
        Object.entries(data).forEach(([field, value]) => {
          if (typeof value === 'string' && value.length > 0) {
            if (!this.recentValues.has(field)) {
              this.recentValues.set(field, [])
            }
            const values = this.recentValues.get(field)!
            if (!values.includes(value)) {
              values.unshift(value) // Add to beginning
              if (values.length > 5) values.pop() // Keep only 5 recent values
            }
          }
        })
      } catch (e) {
        // Skip invalid JSON entries
      }
    })
  }

  async getSuggestions(fieldName: string, value: string, entryType: string): Promise<SmartSuggestion[]> {
    await this.initialize()
    
    const suggestions: SmartSuggestion[] = []
    const lowerValue = value.toLowerCase()

    if (fieldName === 'symbol' && entryType === 'stock_holding') {
      // Stock symbol suggestions
      Array.from(this.stockSymbols)
        .filter(symbol => symbol.toLowerCase().includes(lowerValue))
        .slice(0, 5)
        .forEach(symbol => {
          const companyName = this.companyNames.get(symbol)
          suggestions.push({
            value: symbol,
            label: companyName ? `${symbol} - ${companyName}` : symbol,
            type: 'symbol',
            metadata: { companyName }
          })
        })
    }

    if (fieldName === 'company_symbol' && entryType === 'morgan_stanley') {
      // Company symbol for equity grants
      Array.from(this.stockSymbols)
        .filter(symbol => symbol.toLowerCase().includes(lowerValue))
        .slice(0, 5)
        .forEach(symbol => {
          const companyName = this.companyNames.get(symbol)
          suggestions.push({
            value: symbol,
            label: companyName ? `${symbol} - ${companyName}` : symbol,
            type: 'symbol',
            metadata: { companyName }
          })
        })
    }

    // Recent values for any field
    const recentValues = this.recentValues.get(fieldName) || []
    recentValues
      .filter(recentValue => recentValue.toLowerCase().includes(lowerValue))
      .slice(0, 3)
      .forEach(recentValue => {
        if (!suggestions.some(s => s.value === recentValue)) {
          suggestions.push({
            value: recentValue,
            label: `Recent: ${recentValue}`,
            type: 'recent'
          })
        }
      })

    return suggestions
  }

  async validateEntry(formData: Record<string, any>, entryType: string): Promise<ValidationResult> {
    await this.initialize()
    
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check for duplicates
    if (entryType === 'stock_holding' && formData.symbol) {
      const symbol = formData.symbol.toUpperCase()
      const existingStock = this.existingEntries.find(entry => {
        if (entry.entry_type !== 'stock_holding') return false
        try {
          const data = JSON.parse(entry.data_json)
          return data.symbol?.toUpperCase() === symbol
        } catch {
          return false
        }
      })

      if (existingStock) {
        warnings.push(`You already have an entry for ${symbol}. Consider updating the existing entry instead.`)
      }
    }

    // Mathematical validation for stocks
    if (entryType === 'stock_holding') {
      const { shares_owned, current_price, cost_basis } = formData
      
      if (shares_owned && current_price) {
        const marketValue = shares_owned * current_price
        if (marketValue > 0) {
          suggestions.push(`Current market value: $${marketValue.toLocaleString()}`)
        }
      }

      if (shares_owned && cost_basis && current_price) {
        const totalCost = shares_owned * cost_basis
        const currentValue = shares_owned * current_price
        const gainLoss = currentValue - totalCost
        const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0

        if (gainLoss !== 0) {
          const sign = gainLoss > 0 ? '+' : ''
          suggestions.push(
            `Unrealized ${gainLoss > 0 ? 'gain' : 'loss'}: ${sign}$${gainLoss.toLocaleString()} (${sign}${gainLossPercent.toFixed(1)}%)`
          )
        }
      }
    }

    // Validation for equity grants (Morgan Stanley)
    if (entryType === 'morgan_stanley') {
      const { grant_type, total_shares, vested_shares, strike_price, grant_date, vest_start_date } = formData
      
      // Share math validation
      if (total_shares && vested_shares) {
        if (vested_shares > total_shares) {
          warnings.push('Vested shares cannot exceed total shares')
        } else {
          const unvested = total_shares - vested_shares
          suggestions.push(`Unvested shares: ${unvested.toLocaleString()}`)
        }
      }

      // Grant type specific validation
      if (grant_type === 'stock_option' && !strike_price) {
        warnings.push('Strike price is required for stock options')
      }
      if (grant_type === 'rsu' && strike_price) {
        suggestions.push('Strike price is not applicable for RSUs (you can leave it empty)')
      }

      // Date validation
      if (grant_date && vest_start_date) {
        const grantDateTime = new Date(grant_date).getTime()
        const vestStartDateTime = new Date(vest_start_date).getTime()
        
        if (grantDateTime > vestStartDateTime) {
          warnings.push('Vesting start date should be on or after grant date')
        }
      }

      // Check for potential duplicates
      const symbol = formData.company_symbol?.toUpperCase()
      if (symbol) {
        const existingGrant = this.existingEntries.find(entry => {
          if (entry.entry_type !== 'morgan_stanley') return false
          try {
            const data = JSON.parse(entry.data_json)
            return data.company_symbol?.toUpperCase() === symbol && data.grant_type === grant_type
          } catch {
            return false
          }
        })

        if (existingGrant) {
          warnings.push(`You already have a ${grant_type} grant for ${symbol}. Consider updating the existing entry.`)
        }
      }
    }

    // Validation for real estate
    if (entryType === 'real_estate') {
      const { purchase_price, current_value, outstanding_mortgage } = formData
      
      if (current_value && outstanding_mortgage) {
        const equity = current_value - outstanding_mortgage
        if (equity !== formData.equity) {
          suggestions.push(`Calculated equity: $${equity.toLocaleString()}`)
        }
      }

      if (purchase_price && current_value) {
        const appreciation = current_value - purchase_price
        const appreciationPercent = purchase_price > 0 ? (appreciation / purchase_price) * 100 : 0
        if (appreciation !== 0) {
          const sign = appreciation > 0 ? '+' : ''
          suggestions.push(
            `Property ${appreciation > 0 ? 'appreciation' : 'depreciation'}: ${sign}$${appreciation.toLocaleString()} (${sign}${appreciationPercent.toFixed(1)}%)`
          )
        }
      }
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    }
  }

  getCompanyName(symbol: string): string | undefined {
    return this.companyNames.get(symbol.toUpperCase())
  }

  // Store recent value for future suggestions
  addRecentValue(fieldName: string, value: string) {
    if (!value || value.length === 0) return
    
    if (!this.recentValues.has(fieldName)) {
      this.recentValues.set(fieldName, [])
    }
    
    const values = this.recentValues.get(fieldName)!
    const index = values.indexOf(value)
    
    if (index > -1) {
      values.splice(index, 1) // Remove if exists
    }
    
    values.unshift(value) // Add to beginning
    if (values.length > 5) values.pop() // Keep only 5 recent values
  }
}

export const smartDataService = new SmartDataService()