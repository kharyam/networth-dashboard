// Property Valuation Service Interface
// Provides a clean interface for property valuation that can be easily swapped
// between manual entry and future API providers (Redfin, Zillow, etc.)

import { propertyValuationApi } from './api'

export interface PropertyValuation {
  estimated_value: number
  confidence_score?: number
  last_updated: Date
  source: string
  comparable_properties?: ComparableProperty[]
  property_details?: PropertyDetails
}

export interface PropertyDetails {
  address: string
  city: string
  state: string
  zip_code: string
  property_type?: string
  year_built?: number
  bedrooms?: number
  bathrooms?: number
  property_size_sqft?: number
  lot_size_acres?: number
}

export interface ComparableProperty {
  address: string
  sale_price: number
  sale_date: Date
  property_size_sqft?: number
  lot_size_acres?: number
}

export interface PropertyValuationProvider {
  getPropertyValue(params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation>
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

  async getPropertyValue(params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation> {
    // For manual provider, we return the current value as-is
    // In a real scenario, this might query internal database for last entered value
    return {
      estimated_value: params.currentValue || 0,
      confidence_score: params.currentValue && params.currentValue > 0 ? 100 : 0, // 100% confidence for manual entry
      last_updated: new Date(),
      source: 'Manual Entry',
    }
  }
}

// ATTOM Data API Provider - Uses backend service for property valuation
class AttomDataValuationProvider implements PropertyValuationProvider {
  getProviderName(): string {
    return 'ATTOM Data API'
  }

  isAvailable(): boolean {
    // Return true to allow the provider to be selected
    // The actual backend availability will be checked when making API calls
    return true
  }

  async checkBackendAvailability(): Promise<boolean> {
    try {
      const providers = await propertyValuationApi.getProviders()
      return providers.providers?.some((p: any) => 
        p.name === 'ATTOM Data API' && p.available
      ) || false
    } catch {
      return false
    }
  }

  getSupportedRegions(): string[] {
    return ['US'] // ATTOM Data covers US market
  }

  async getPropertyValue(params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation> {
    console.log('🔄 [AttomDataProvider] getPropertyValue() called with params:', params)
    
    const apiParams = {
      address: params.address,
      city: params.city,
      state: params.state,
      zip_code: params.zip_code
    }
    
    console.log('🔄 [AttomDataProvider] Built API params:', apiParams)
    console.log('🔄 [AttomDataProvider] About to call propertyValuationApi.refreshValuation()')
    
    try {
      const valuation = await propertyValuationApi.refreshValuation(apiParams)
      
      console.log('✅ [AttomDataProvider] API call successful, raw response:', valuation)
      
      const result = {
        estimated_value: valuation.estimated_value,
        confidence_score: valuation.confidence_score,
        last_updated: new Date(valuation.last_updated),
        source: valuation.source,
        property_details: valuation.property_details,
        comparable_properties: valuation.comparable_properties
      }
      
      console.log('✅ [AttomDataProvider] Returning formatted result:', result)
      return result
    } catch (error: unknown) {
      console.error('❌ [AttomDataProvider] API call failed:', error)
      
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        responseData: (error as any)?.response?.data,
        requestMethod: (error as any)?.config?.method,
        requestURL: (error as any)?.config?.url,
        requestParams: (error as any)?.config?.params,
        baseURL: (error as any)?.config?.baseURL,
        fullURL: (error as any)?.config?.baseURL + (error as any)?.config?.url,
        headers: (error as any)?.config?.headers
      }
      
      console.error('❌ [AttomDataProvider] Detailed error information:', errorDetails)
      
      // Create more specific error message based on status code
      let errorMessage = 'Failed to fetch property valuation from ATTOM Data API'
      if (errorDetails.status) {
        switch (errorDetails.status) {
          case 400:
            errorMessage = `Bad request to ATTOM Data API (${errorDetails.status}): ${errorDetails.responseData?.error || 'Invalid parameters'}`
            break
          case 401:
            errorMessage = `ATTOM Data API authentication failed (${errorDetails.status}): Invalid API key`
            break
          case 403:
            errorMessage = `ATTOM Data API access forbidden (${errorDetails.status}): API key may be expired or rate limited`
            break
          case 404:
            errorMessage = `ATTOM Data API endpoint not found (${errorDetails.status}): Property data not available`
            break
          case 429:
            errorMessage = `ATTOM Data API rate limit exceeded (${errorDetails.status}): Too many requests`
            break
          case 500:
            errorMessage = `ATTOM Data API server error (${errorDetails.status}): Backend service unavailable`
            break
          default:
            errorMessage = `ATTOM Data API error (${errorDetails.status}): ${errorDetails.statusText || 'Unknown error'}`
        }
      }
      
      throw new Error(errorMessage)
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

  async getPropertyValue(_params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation> {
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
        body: JSON.stringify({ 
          address: params.address,
          city: params.city,
          state: params.state,
          zip_code: params.zip_code,
          api_key: this.apiKey 
        })
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
  private featureEnabled: boolean | null = null

  constructor() {
    console.log('🏗️ [PropertyValuationService] Initializing service')
    
    // Initialize with available providers
    this.providers = [
      new ManualValuationProvider(),
      new AttomDataValuationProvider(),
      new RedfinValuationProvider(), // Will be unavailable until API key is provided
    ]

    console.log('🏗️ [PropertyValuationService] Available providers:', this.providers.map(p => ({
      name: p.getProviderName(),
      available: p.isAvailable()
    })))

    // Always use ATTOM Data provider for refresh operations to ensure API calls are made
    // It will gracefully fall back to manual entry if the backend API is unavailable
    this.primaryProvider = this.providers.find(p => 
      p.getProviderName() === 'ATTOM Data API'
    ) || new ManualValuationProvider()
    
    console.log('🏗️ [PropertyValuationService] Selected primary provider:', this.primaryProvider.getProviderName())
  }

  // Check if property valuation feature is enabled on backend
  async checkFeatureEnabled(): Promise<boolean> {
    try {
      const status = await propertyValuationApi.checkFeatureStatus()
      this.featureEnabled = status.feature_enabled
      console.log('🔧 [PropertyValuationService] Feature status checked:', {
        enabled: this.featureEnabled,
        message: status.message
      })
      return this.featureEnabled
    } catch (error) {
      console.error('❌ [PropertyValuationService] Failed to check feature status:', error)
      this.featureEnabled = false
      return false
    }
  }

  // Get cached feature status or check with backend
  async isFeatureEnabled(): Promise<boolean> {
    if (this.featureEnabled === null) {
      return await this.checkFeatureEnabled()
    }
    return this.featureEnabled
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
  async getPropertyValuation(params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation> {
    console.log('🔄 [PropertyValuationService] getPropertyValuation() called with params:', params)
    
    // Check if feature is enabled
    const featureEnabled = await this.isFeatureEnabled()
    if (!featureEnabled) {
      console.log('⚠️ [PropertyValuationService] Property valuation feature is disabled, using manual entry')
      const manualProvider = this.providers.find(p => p.getProviderName() === 'Manual Entry')
      if (manualProvider) {
        const result = await manualProvider.getPropertyValue(params)
        result.source = 'Manual Entry (Feature disabled)'
        return result
      }
      throw new Error('Property valuation feature is disabled and manual provider not available')
    }
    
    console.log('🔄 [PropertyValuationService] About to call primaryProvider.getPropertyValue():', this.primaryProvider.getProviderName())
    
    try {
      const result = await this.primaryProvider.getPropertyValue(params)
      console.log('✅ [PropertyValuationService] Primary provider returned result:', result)
      return result
    } catch (error) {
      console.error(`❌ [PropertyValuationService] Property valuation failed with ${this.primaryProvider.getProviderName()}:`, error)
      
      // Always fallback to manual provider when ATTOM Data fails
      if (this.primaryProvider.getProviderName() !== 'Manual Entry') {
        const manualProvider = this.providers.find(p => p.getProviderName() === 'Manual Entry')
        if (manualProvider) {
          console.log('🔄 [PropertyValuationService] ATTOM Data API failed, falling back to manual valuation provider')
          console.log('🔄 [PropertyValuationService] This will return the current property value as-is')
          
          try {
            const fallbackResult = await manualProvider.getPropertyValue(params)
            console.log('✅ [PropertyValuationService] Fallback provider returned result:', fallbackResult)
            
            // Add a note to the result that this came from fallback
            fallbackResult.source = 'Manual Entry (ATTOM Data unavailable)'
            return fallbackResult
          } catch (fallbackError) {
            console.error('❌ [PropertyValuationService] Even fallback provider failed:', fallbackError)
            throw new Error('Both ATTOM Data API and fallback provider failed')
          }
        }
      }
      
      console.error('❌ [PropertyValuationService] No fallback provider available, throwing error')
      throw error
    }
  }

  // Refresh property valuation with fallback handling
  async refreshPropertyValue(params: {
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue?: number
  }): Promise<PropertyValuation> {
    console.log('🔄 [PropertyValuationService] refreshPropertyValue() called with params:', params)
    
    // Check if feature is enabled
    const featureEnabled = await this.isFeatureEnabled()
    if (!featureEnabled) {
      console.log('⚠️ [PropertyValuationService] Property valuation feature is disabled, refresh will return current value')
      const manualProvider = this.providers.find(p => p.getProviderName() === 'Manual Entry')
      if (manualProvider) {
        const result = await manualProvider.getPropertyValue(params)
        result.source = 'Manual Entry (Property valuation disabled)'
        return result
      }
      throw new Error('Property valuation feature is disabled and manual provider not available')
    }
    
    console.log('🔄 [PropertyValuationService] Using primary provider:', this.primaryProvider.getProviderName())
    
    const result = await this.getPropertyValuation(params)
    
    console.log('🔄 [PropertyValuationService] refreshPropertyValue() returning result:', result)
    return result
  }

  // Legacy method for backward compatibility
  async refreshPropertyValueLegacy(address: string, currentValue: number): Promise<PropertyValuation> {
    return await this.refreshPropertyValue({ address, currentValue })
  }

  // Batch refresh multiple properties
  async refreshMultipleProperties(properties: Array<{
    address?: string
    city?: string
    state?: string
    zip_code?: string
    currentValue: number
  }>): Promise<PropertyValuation[]> {
    const results = await Promise.allSettled(
      properties.map(prop => this.refreshPropertyValue(prop))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        console.error(`Failed to refresh property ${properties[index].address || 'unknown'}:`, result.reason)
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