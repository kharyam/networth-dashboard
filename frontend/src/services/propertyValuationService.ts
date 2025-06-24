// Property Valuation Service Interface
// Provides a clean interface for property valuation that can be easily swapped
// between manual entry and future API providers (Redfin, Zillow, etc.)

export interface PropertyValuation {
  estimated_value: number
  confidence_score?: number
  last_updated: Date
  source: string
  comparable_properties?: ComparableProperty[]
}

export interface ComparableProperty {
  address: string
  sale_price: number
  sale_date: Date
  property_size_sqft?: number
  lot_size_acres?: number
}

export interface PropertyValuationProvider {
  getPropertyValue(address: string, currentValue?: number): Promise<PropertyValuation>
  getProviderName(): string
  isAvailable(): boolean
  getSupportedRegions?(): string[]
}

// Manual Valuation Provider - Uses existing estimated values from forms
class ManualValuationProvider implements PropertyValuationProvider {
  getProviderName(): string {
    return 'Manual Entry'
  }

  isAvailable(): boolean {
    return true
  }

  async getPropertyValue(_address: string, currentValue: number = 0): Promise<PropertyValuation> {
    // For manual provider, we return the current value as-is
    // In a real scenario, this might query internal database for last entered value
    return {
      estimated_value: currentValue,
      confidence_score: currentValue > 0 ? 100 : 0, // 100% confidence for manual entry
      last_updated: new Date(),
      source: 'Manual Entry',
    }
  }
}

// Future Redfin API Provider (placeholder for implementation)
class RedfinValuationProvider implements PropertyValuationProvider {
  private apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  getProviderName(): string {
    return 'Redfin API'
  }

  isAvailable(): boolean {
    // For now, always return false since we don't have API integration yet
    return false && !!this.apiKey
  }

  getSupportedRegions(): string[] {
    return ['US'] // Redfin primarily covers US market
  }

  async getPropertyValue(_address: string): Promise<PropertyValuation> {
    if (!this.isAvailable()) {
      throw new Error('Redfin API not available - missing API key or not implemented')
    }

    // TODO: Implement actual Redfin API call
    // This is a placeholder for future implementation
    /*
    try {
      const response = await fetch(`/api/redfin/valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, api_key: this.apiKey })
      })
      
      const data = await response.json()
      return {
        estimated_value: data.estimated_value,
        confidence_score: data.confidence_score,
        last_updated: new Date(data.last_updated),
        source: 'Redfin API',
        comparable_properties: data.comparables
      }
    } catch (error) {
      console.error('Redfin API error:', error)
      throw new Error('Failed to fetch property valuation from Redfin')
    }
    */
    
    throw new Error('Redfin API integration not yet implemented')
  }
}

// Property Valuation Service - Main service class
export class PropertyValuationService {
  private providers: PropertyValuationProvider[]
  private primaryProvider: PropertyValuationProvider

  constructor() {
    // Initialize with available providers
    this.providers = [
      new ManualValuationProvider(),
      new RedfinValuationProvider(), // Will be unavailable until API key is provided
    ]

    // Set primary provider to manual for now
    this.primaryProvider = this.providers.find(p => p.isAvailable()) || new ManualValuationProvider()
  }

  // Get available providers
  getAvailableProviders(): PropertyValuationProvider[] {
    return this.providers.filter(p => p.isAvailable())
  }

  // Get current primary provider
  getPrimaryProvider(): PropertyValuationProvider {
    return this.primaryProvider
  }

  // Set primary provider
  setPrimaryProvider(providerName: string): boolean {
    const provider = this.providers.find(p => 
      p.getProviderName() === providerName && p.isAvailable()
    )
    
    if (provider) {
      this.primaryProvider = provider
      return true
    }
    
    return false
  }

  // Get property valuation using primary provider
  async getPropertyValuation(address: string, currentValue?: number): Promise<PropertyValuation> {
    try {
      return await this.primaryProvider.getPropertyValue(address, currentValue)
    } catch (error) {
      console.error(`Property valuation failed with ${this.primaryProvider.getProviderName()}:`, error)
      
      // Fallback to manual provider if primary fails
      if (this.primaryProvider.getProviderName() !== 'Manual Entry') {
        const manualProvider = this.providers.find(p => p.getProviderName() === 'Manual Entry')
        if (manualProvider) {
          console.log('Falling back to manual valuation provider')
          return await manualProvider.getPropertyValue(address, currentValue)
        }
      }
      
      throw error
    }
  }

  // Refresh property valuation with fallback handling
  async refreshPropertyValue(address: string, currentValue: number): Promise<PropertyValuation> {
    return await this.getPropertyValuation(address, currentValue)
  }

  // Batch refresh multiple properties
  async refreshMultipleProperties(properties: Array<{address: string, currentValue: number}>): Promise<PropertyValuation[]> {
    const results = await Promise.allSettled(
      properties.map(prop => this.refreshPropertyValue(prop.address, prop.currentValue))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        console.error(`Failed to refresh property ${properties[index].address}:`, result.reason)
        // Return current value as fallback
        return {
          estimated_value: properties[index].currentValue,
          confidence_score: 0,
          last_updated: new Date(),
          source: 'Fallback - Error occurred',
        }
      }
    })
  }
}

// Export singleton instance
export const propertyValuationService = new PropertyValuationService()