package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
	"networth-dashboard/internal/config"
)

// PropertyValuation represents a property valuation result
type PropertyValuation struct {
	EstimatedValue     float64                `json:"estimated_value"`
	ConfidenceScore    *float64               `json:"confidence_score,omitempty"`
	LastUpdated        time.Time              `json:"last_updated"`
	Source             string                 `json:"source"`
	ComparableProperties []*ComparableProperty `json:"comparable_properties,omitempty"`
	PropertyDetails    *PropertyDetails       `json:"property_details,omitempty"`
}

// ComparableProperty represents a comparable property
type ComparableProperty struct {
	Address          string    `json:"address"`
	SalePrice        float64   `json:"sale_price"`
	SaleDate         time.Time `json:"sale_date"`
	PropertySizeSqft *float64  `json:"property_size_sqft,omitempty"`
	LotSizeAcres     *float64  `json:"lot_size_acres,omitempty"`
	Distance         *float64  `json:"distance,omitempty"`
}

// PropertyDetails represents detailed property information
type PropertyDetails struct {
	Address          string   `json:"address"`
	City             string   `json:"city"`
	State            string   `json:"state"`
	ZipCode          string   `json:"zip_code"`
	PropertyType     string   `json:"property_type"`
	YearBuilt        *int     `json:"year_built,omitempty"`
	Bedrooms         *int     `json:"bedrooms,omitempty"`
	Bathrooms        *float64 `json:"bathrooms,omitempty"`
	PropertySizeSqft *float64 `json:"property_size_sqft,omitempty"`
	LotSizeAcres     *float64 `json:"lot_size_acres,omitempty"`
}

// AttomDataResponse represents the response from ATTOM Data API
type AttomDataResponse struct {
	Status struct {
		Version string `json:"version"`
		Code    int    `json:"code"`
		Msg     string `json:"msg"`
		Total   int    `json:"total"`
	} `json:"status"`
	Property []struct {
		Identifier struct {
			Id     string `json:"Id"`
			Fips   string `json:"fips"`
			Apn    string `json:"apn"`
		} `json:"identifier"`
		Address struct {
			Country      string `json:"country"`
			CountrySubd  string `json:"countrySubd"`
			Line1        string `json:"line1"`
			Line2        string `json:"line2,omitempty"`
			Locality     string `json:"locality"`
			MatchCode    string `json:"matchCode"`
			OneLine      string `json:"oneLine"`
			Postal1      string `json:"postal1"`
			Postal2      string `json:"postal2,omitempty"`
			Postal3      string `json:"postal3,omitempty"`
		} `json:"address"`
		Lot struct {
			LotSize1    float64 `json:"lotsize1,omitempty"`
			LotSize2    float64 `json:"lotsize2,omitempty"`
		} `json:"lot,omitempty"`
		Area struct {
			BlockNum           string  `json:"blockNum,omitempty"`
			Building           float64 `json:"building,omitempty"`
			CountyUse1         string  `json:"countyUse1,omitempty"`
			CountyUse2         string  `json:"countyUse2,omitempty"`
			CountyUseGeneral   string  `json:"countyUseGeneral,omitempty"`
		} `json:"area,omitempty"`
		Building struct {
			Rooms struct {
				Bathstotal float64 `json:"bathstotal,omitempty"`
				Beds       int     `json:"beds,omitempty"`
			} `json:"rooms,omitempty"`
			Size struct {
				BldgSize          float64 `json:"bldgsize,omitempty"`
				GroundFloorSize   float64 `json:"groundfloorsize,omitempty"`
				LivingSize        float64 `json:"livingsize,omitempty"`
				UniversalSize     float64 `json:"universalsize,omitempty"`
			} `json:"size,omitempty"`
			Construction struct {
				YearBuilt int `json:"yearbuilt,omitempty"`
			} `json:"construction,omitempty"`
		} `json:"building,omitempty"`
		Assessment struct {
			Assessed struct {
				AssdTtlValue float64 `json:"assdttlvalue,omitempty"`
			} `json:"assessed,omitempty"`
			Market struct {
				MktTtlValue float64 `json:"mktttlvalue,omitempty"`
			} `json:"market,omitempty"`
		} `json:"assessment,omitempty"`
		Vintage struct {
			LastModified string `json:"lastModified,omitempty"`
			PubDate      string `json:"pubDate,omitempty"`
		} `json:"vintage,omitempty"`
	} `json:"property"`
}

// PropertyValuationService handles property valuation API calls
type PropertyValuationService struct {
	attomAPIKey              string
	attomBaseURL             string
	httpClient               *http.Client
	propertyValuationEnabled bool
	attomDataEnabled         bool
}

// NewPropertyValuationService creates a new property valuation service
func NewPropertyValuationService(cfg *config.ApiConfig) *PropertyValuationService {
	return &PropertyValuationService{
		attomAPIKey:              cfg.AttomDataAPIKey,
		attomBaseURL:             cfg.AttomDataBaseURL,
		propertyValuationEnabled: cfg.PropertyValuationEnabled,
		attomDataEnabled:         cfg.AttomDataEnabled,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// IsPropertyValuationEnabled checks if property valuation feature is enabled
func (pvs *PropertyValuationService) IsPropertyValuationEnabled() bool {
	return pvs.propertyValuationEnabled
}

// IsAttomDataAvailable checks if ATTOM Data API is available
func (pvs *PropertyValuationService) IsAttomDataAvailable() bool {
	return pvs.attomDataEnabled && pvs.attomAPIKey != "" && pvs.attomAPIKey != "your_attom_data_api_key_here"
}

// GetProviderName returns the name of the active provider
func (pvs *PropertyValuationService) GetProviderName() string {
	if pvs.IsAttomDataAvailable() {
		return "ATTOM Data API"
	}
	return "Manual Entry"
}

// GetPropertyValuation gets property valuation using the best available provider
func (pvs *PropertyValuationService) GetPropertyValuation(address, city, state, zipCode string) (*PropertyValuation, error) {
	// Check if property valuation feature is enabled
	if !pvs.propertyValuationEnabled {
		return &PropertyValuation{
			EstimatedValue:  0,
			ConfidenceScore: nil,
			LastUpdated:     time.Now(),
			Source:          "Manual Entry (Property valuation disabled)",
		}, nil
	}
	
	if pvs.IsAttomDataAvailable() {
		return pvs.getAttomDataValuation(address, city, state, zipCode)
	}
	
	// Fallback to manual entry (no API call needed)
	return &PropertyValuation{
		EstimatedValue:  0,
		ConfidenceScore: nil,
		LastUpdated:     time.Now(),
		Source:          "Manual Entry",
	}, nil
}

// getAttomDataValuation calls ATTOM Data API for property valuation
func (pvs *PropertyValuationService) getAttomDataValuation(address, city, state, zipCode string) (*PropertyValuation, error) {
	// Build query parameters using correct ATTOM Data API parameter names
	params := url.Values{}
	
	// Try different parameter combinations based on what's available
	if address != "" && city != "" && state != "" {
		// Use address1 + address2 combination (recommended)
		params.Set("address1", address)
		params.Set("address2", fmt.Sprintf("%s, %s", city, state))
	} else if zipCode != "" {
		// Use ZIP code alone if full address isn't available
		params.Set("postalcode", zipCode)
	} else if address != "" {
		// Use address1 alone
		params.Set("address1", address)
	} else {
		return nil, fmt.Errorf("insufficient address information for ATTOM Data API")
	}
	
	// At least one parameter should be set by now
	if len(params) == 0 {
		return nil, fmt.Errorf("at least one address component is required")
	}
	
	// Build request URL
	requestURL := fmt.Sprintf("%s/property/detail?%s", pvs.attomBaseURL, params.Encode())
	
	// Create request
	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Set headers - ATTOM Data API uses 'apikey' header
	req.Header.Set("Accept", "application/json")
	req.Header.Set("apikey", pvs.attomAPIKey)
	
	// Log the request for debugging
	fmt.Printf("ATTOM Data API Request - URL: %s, API Key: %s...%s\n", 
		requestURL, pvs.attomAPIKey[:8], pvs.attomAPIKey[len(pvs.attomAPIKey)-4:])
	
	// Make request
	resp, err := pvs.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make API request: %w", err)
	}
	defer resp.Body.Close()
	
	// Check response status
	if resp.StatusCode != http.StatusOK {
		// Read response body for error details
		bodyBytes, _ := io.ReadAll(resp.Body)
		bodyString := string(bodyBytes)
		
		// Log the error details for debugging
		fmt.Printf("ATTOM Data API Error - Status: %d, URL: %s, Response: %s\n", 
			resp.StatusCode, requestURL, bodyString)
		
		return nil, fmt.Errorf("API request failed with status %d", resp.StatusCode)
	}
	
	// Parse response
	var attomResp AttomDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&attomResp); err != nil {
		return nil, fmt.Errorf("failed to decode API response: %w", err)
	}
	
	// Check API response status
	if attomResp.Status.Code != 0 {
		return nil, fmt.Errorf("API returned error: %s", attomResp.Status.Msg)
	}
	
	// Check if we got results
	if len(attomResp.Property) == 0 {
		return nil, fmt.Errorf("no property data found for the given address")
	}
	
	// Use the first property result
	property := attomResp.Property[0]
	
	// Extract estimated value (prefer market value, fallback to assessed value)
	var estimatedValue float64
	var confidenceScore float64 = 75 // Default confidence for ATTOM Data
	
	if property.Assessment.Market.MktTtlValue > 0 {
		estimatedValue = property.Assessment.Market.MktTtlValue
		confidenceScore = 85 // Higher confidence for market value
	} else if property.Assessment.Assessed.AssdTtlValue > 0 {
		estimatedValue = property.Assessment.Assessed.AssdTtlValue
		confidenceScore = 65 // Lower confidence for assessed value
	} else {
		return nil, fmt.Errorf("no valuation data available for this property")
	}
	
	// Create property details
	propertyDetails := &PropertyDetails{
		Address:     property.Address.OneLine,
		City:        property.Address.Locality,
		State:       property.Address.CountrySubd,
		ZipCode:     property.Address.Postal1,
		PropertyType: property.Area.CountyUseGeneral,
	}
	
	// Add optional details
	if property.Building.Construction.YearBuilt > 0 {
		propertyDetails.YearBuilt = &property.Building.Construction.YearBuilt
	}
	if property.Building.Rooms.Beds > 0 {
		propertyDetails.Bedrooms = &property.Building.Rooms.Beds
	}
	if property.Building.Rooms.Bathstotal > 0 {
		propertyDetails.Bathrooms = &property.Building.Rooms.Bathstotal
	}
	if property.Building.Size.LivingSize > 0 {
		propertyDetails.PropertySizeSqft = &property.Building.Size.LivingSize
	}
	if property.Lot.LotSize1 > 0 {
		// Convert square feet to acres (1 acre = 43,560 sq ft)
		acres := property.Lot.LotSize1 / 43560
		propertyDetails.LotSizeAcres = &acres
	}
	
	// Parse last updated time
	lastUpdated := time.Now()
	if property.Vintage.LastModified != "" {
		if parsed, err := time.Parse("2006-01-02", property.Vintage.LastModified); err == nil {
			lastUpdated = parsed
		}
	}
	
	return &PropertyValuation{
		EstimatedValue:  estimatedValue,
		ConfidenceScore: &confidenceScore,
		LastUpdated:     lastUpdated,
		Source:          "ATTOM Data API",
		PropertyDetails: propertyDetails,
	}, nil
}

// RefreshPropertyValuation refreshes a property valuation
func (pvs *PropertyValuationService) RefreshPropertyValuation(address, city, state, zipCode string) (*PropertyValuation, error) {
	return pvs.GetPropertyValuation(address, city, state, zipCode)
}