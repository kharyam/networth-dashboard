package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"
	"networth-dashboard/internal/config"
)

// PriceProvider interface allows easy swapping of price data sources
type PriceProvider interface {
	GetCurrentPrice(symbol string) (float64, error)
	GetMultiplePrices(symbols []string) (map[string]float64, error)
	GetProviderName() string
}

// MockPriceProvider provides realistic mock stock prices for development
type MockPriceProvider struct {
	mockPrices map[string]float64
	rand       *rand.Rand
}

// NewMockPriceProvider creates a new mock price provider with realistic prices
func NewMockPriceProvider() *MockPriceProvider {
	return &MockPriceProvider{
		mockPrices: map[string]float64{
			// Major tech stocks
			"AAPL":  190.50,
			"MSFT":  380.25,
			"GOOGL": 140.75,
			"GOOG":  140.75,
			"AMZN":  155.30,
			"TSLA":  245.80,
			"META":  325.40,
			"NVDA":  450.60,
			"NFLX":  485.20,
			"CRM":   210.40,
			"ORCL":  115.80,
			"ADBE":  520.30,
			"INTC":  45.60,
			"AMD":   125.90,
			"IBM":   189.0,

			// Financial stocks
			"JPM": 155.40,
			"BAC": 32.80,
			"WFC": 42.60,
			"GS":  365.20,
			"MS":  85.40,

			// Other popular stocks
			"COST": 720.80,
			"WMT":  165.20,
			"HD":   325.60,
			"PG":   155.90,
			"JNJ":  160.40,
			"V":    255.30,
			"MA":   425.80,
			"UNH":  520.90,
			"KO":   59.80,
			"PEP":  175.20,
		},
		rand: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GetCurrentPrice returns the current price for a symbol with small random variation
func (m *MockPriceProvider) GetCurrentPrice(symbol string) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	if symbol == "" {
		return 0, fmt.Errorf("symbol cannot be empty")
	}

	basePrice, exists := m.mockPrices[symbol]
	if !exists {
		// Generate reasonable price for unknown symbols (between $10-$500)
		basePrice = 10.0 + m.rand.Float64()*490.0
	}

	// Add small random variation to simulate market movement (±2%)
	variation := (m.rand.Float64() - 0.5) * 0.04
	finalPrice := basePrice * (1 + variation)

	// Round to 2 decimal places
	return float64(int(finalPrice*100)) / 100, nil
}

// GetMultiplePrices returns prices for multiple symbols efficiently
func (m *MockPriceProvider) GetMultiplePrices(symbols []string) (map[string]float64, error) {
	results := make(map[string]float64)
	var errors []string

	for _, symbol := range symbols {
		price, err := m.GetCurrentPrice(symbol)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", symbol, err))
			continue
		}
		results[symbol] = price
	}

	if len(errors) > 0 {
		return results, fmt.Errorf("errors fetching prices: %s", strings.Join(errors, "; "))
	}

	return results, nil
}

// GetProviderName returns the name of this provider
func (m *MockPriceProvider) GetProviderName() string {
	return "Mock Price Provider"
}

// AlphaVantageResponse represents the response from Alpha Vantage API
type AlphaVantageResponse struct {
	GlobalQuote struct {
		Symbol           string `json:"01. symbol"`
		Open             string `json:"02. open"`
		High             string `json:"03. high"`
		Low              string `json:"04. low"`
		Price            string `json:"05. price"`
		Volume           string `json:"06. volume"`
		LatestTradingDay string `json:"07. latest trading day"`
		PreviousClose    string `json:"08. previous close"`
		Change           string `json:"09. change"`
		ChangePercent    string `json:"10. change percent"`
	} `json:"Global Quote"`
}

// AlphaVantagePriceProvider provides real stock prices from Alpha Vantage API
type AlphaVantagePriceProvider struct {
	apiKey        string
	client        *http.Client
	db            *sql.DB
	marketService *MarketHoursService
	config        *config.ApiConfig
	baseURL       string
}

// NewAlphaVantagePriceProvider creates a new Alpha Vantage price provider
func NewAlphaVantagePriceProvider(apiKey string, db *sql.DB, marketService *MarketHoursService, cfg *config.ApiConfig) *AlphaVantagePriceProvider {
	return &AlphaVantagePriceProvider{
		apiKey:        apiKey,
		client:        &http.Client{Timeout: 30 * time.Second},
		db:            db,
		marketService: marketService,
		config:        cfg,
		baseURL:       "https://www.alphavantage.co/query",
	}
}

// GetCurrentPrice gets the current price for a symbol with market-aware caching
func (av *AlphaVantagePriceProvider) GetCurrentPrice(symbol string) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	if symbol == "" {
		return 0, fmt.Errorf("symbol cannot be empty")
	}

	// Check cached price first
	cachedPrice, lastUpdate, err := av.getCachedPrice(symbol)
	var hasCache = err == nil
	
	if hasCache {
		// Use market-aware caching logic
		if !av.marketService.ShouldRefreshPrices(lastUpdate, av.config.CacheRefreshInterval) {
			return cachedPrice, nil
		}
	}

	// Check if we can make API call (rate limiting)
	if !av.canMakeAPICall() {
		if hasCache {
			// Return cached price if we hit rate limits but have cache
			return cachedPrice, nil
		}
		// No cache and rate limited - this is a problematic scenario
		return 0, fmt.Errorf("rate limit exceeded and no cached price available for %s. Please try again later when rate limits reset", symbol)
	}

	// Fetch from Alpha Vantage API
	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=%s&apikey=%s", av.baseURL, symbol, av.apiKey)

	resp, err := av.client.Get(url)
	if err != nil {
		// Return cached price on API failure if we have one
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to fetch price from Alpha Vantage and no cached price available for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Return cached price on API error if we have one
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("Alpha Vantage API returned status %d for %s and no cached price available", resp.StatusCode, symbol)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to read response body for %s and no cached price available: %w", symbol, err)
	}

	var response AlphaVantageResponse
	if err := json.Unmarshal(body, &response); err != nil {
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse Alpha Vantage response for %s and no cached price available: %w", symbol, err)
	}

	// Extract price from response
	priceStr := response.GlobalQuote.Price
	if priceStr == "" {
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("no price data found for symbol %s and no cached price available", symbol)
	}

	price := 0.0
	if _, err := fmt.Sscanf(priceStr, "%f", &price); err != nil {
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse price %s for symbol %s and no cached price available: %w", priceStr, symbol, err)
	}

	// Cache the result
	if err := av.cachePrice(symbol, price); err != nil {
		fmt.Printf("Failed to cache price for %s: %v\n", symbol, err)
	}

	// Record API usage
	av.recordAPICall()

	return price, nil
}

// GetMultiplePrices gets prices for multiple symbols efficiently
func (av *AlphaVantagePriceProvider) GetMultiplePrices(symbols []string) (map[string]float64, error) {
	results := make(map[string]float64)
	var errors []string

	for _, symbol := range symbols {
		price, err := av.GetCurrentPrice(symbol)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", symbol, err))
			continue
		}
		results[symbol] = price
	}

	if len(errors) > 0 {
		return results, fmt.Errorf("errors fetching prices: %s", strings.Join(errors, "; "))
	}

	return results, nil
}

// GetProviderName returns the name of this provider
func (av *AlphaVantagePriceProvider) GetProviderName() string {
	return "Alpha Vantage"
}

// getCachedPrice retrieves cached price from database
func (av *AlphaVantagePriceProvider) getCachedPrice(symbol string) (float64, time.Time, error) {
	query := `
		SELECT price, timestamp 
		FROM stock_prices 
		WHERE symbol = $1 
		ORDER BY timestamp DESC 
		LIMIT 1
	`

	var price float64
	var timestamp time.Time
	err := av.db.QueryRow(query, symbol).Scan(&price, &timestamp)
	
	if err == sql.ErrNoRows {
		return 0, time.Time{}, fmt.Errorf("no cached price found")
	}
	if err != nil {
		return 0, time.Time{}, err
	}

	return price, timestamp, nil
}

// cachePrice stores price in database
func (av *AlphaVantagePriceProvider) cachePrice(symbol string, price float64) error {
	query := `
		INSERT INTO stock_prices (symbol, price, timestamp, source)
		VALUES ($1, $2, $3, $4)
	`

	_, err := av.db.Exec(query, symbol, price, time.Now(), "alphavantage")
	return err
}

// canMakeAPICall checks if we can make an API call based on rate limits
func (av *AlphaVantagePriceProvider) canMakeAPICall() bool {
	// Check daily limit
	today := time.Now().Format("2006-01-02")
	dailyCount := av.getAPICallCount(today)
	
	if dailyCount >= av.config.AlphaVantageDailyLimit {
		return false
	}

	// Check rate limit (calls per minute)
	lastMinute := time.Now().Add(-1 * time.Minute)
	recentCount := av.getAPICallCountSince(lastMinute)
	
	return recentCount < av.config.AlphaVantageRateLimit
}

// getAPICallCount gets the number of API calls made today
func (av *AlphaVantagePriceProvider) getAPICallCount(date string) int {
	query := `
		SELECT COUNT(*) 
		FROM stock_prices 
		WHERE source = 'alphavantage' 
		AND DATE(timestamp) = $1
	`

	var count int
	err := av.db.QueryRow(query, date).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// getAPICallCountSince gets the number of API calls made since a specific time
func (av *AlphaVantagePriceProvider) getAPICallCountSince(since time.Time) int {
	query := `
		SELECT COUNT(*) 
		FROM stock_prices 
		WHERE source = 'alphavantage' 
		AND timestamp > $1
	`

	var count int
	err := av.db.QueryRow(query, since).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// recordAPICall records that an API call was made (this is implicit when caching prices)
func (av *AlphaVantagePriceProvider) recordAPICall() {
	// This is automatically recorded when we cache the price
	// Could add explicit API call logging here if needed
}

// PriceService wraps a PriceProvider and provides additional functionality
type PriceService struct {
	provider PriceProvider
}

// NewPriceService creates a new price service with the mock provider by default
func NewPriceService() *PriceService {
	return &PriceService{
		provider: NewMockPriceProvider(),
	}
}

// NewPriceServiceWithAlphaVantage creates a price service with Alpha Vantage provider
func NewPriceServiceWithAlphaVantage(apiKey string, db *sql.DB, marketService *MarketHoursService, cfg *config.ApiConfig) *PriceService {
	if apiKey == "" {
		// Fallback to mock provider if no API key
		return NewPriceService()
	}
	
	alphaVantageProvider := NewAlphaVantagePriceProvider(apiKey, db, marketService, cfg)
	return &PriceService{
		provider: alphaVantageProvider,
	}
}

// NewPriceServiceWithProvider creates a price service with a specific provider
func NewPriceServiceWithProvider(provider PriceProvider) *PriceService {
	return &PriceService{
		provider: provider,
	}
}

// SetProvider allows swapping the price provider (useful for testing or switching APIs)
func (ps *PriceService) SetProvider(provider PriceProvider) {
	ps.provider = provider
}

// GetCurrentPrice gets the current price for a symbol
func (ps *PriceService) GetCurrentPrice(symbol string) (float64, error) {
	return ps.provider.GetCurrentPrice(symbol)
}

// GetMultiplePrices gets prices for multiple symbols
func (ps *PriceService) GetMultiplePrices(symbols []string) (map[string]float64, error) {
	return ps.provider.GetMultiplePrices(symbols)
}

// GetProviderName returns the name of the current provider
func (ps *PriceService) GetProviderName() string {
	return ps.provider.GetProviderName()
}

// PriceUpdateResult represents the result of a price update operation
type PriceUpdateResult struct {
	Symbol    string    `json:"symbol"`
	OldPrice  float64   `json:"old_price"`
	NewPrice  float64   `json:"new_price"`
	Updated   bool      `json:"updated"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// PriceRefreshSummary summarizes a bulk price refresh operation
type PriceRefreshSummary struct {
	TotalSymbols   int                 `json:"total_symbols"`
	UpdatedSymbols int                 `json:"updated_symbols"`
	FailedSymbols  int                 `json:"failed_symbols"`
	Results        []PriceUpdateResult `json:"results"`
	ProviderName   string              `json:"provider_name"`
	Timestamp      time.Time           `json:"timestamp"`
	DurationMs     int64               `json:"duration_ms"`
}
