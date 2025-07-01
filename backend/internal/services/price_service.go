package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
	"networth-dashboard/internal/config"
)

// PriceProvider interface allows easy swapping of price data sources
type PriceProvider interface {
	GetCurrentPrice(symbol string) (float64, error)
	GetMultiplePrices(symbols []string) (map[string]float64, error)
	GetProviderName() string
}

// ForceRefreshProvider interface for providers that support force refresh
type ForceRefreshProvider interface {
	GetCurrentPriceWithForce(symbol string, forceRefresh bool) (float64, error)
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

// AlphaVantageResponse represents the response from Alpha Vantage GLOBAL_QUOTE API
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

// AlphaVantageIntradayResponse represents the response from Alpha Vantage TIME_SERIES_INTRADAY API
type AlphaVantageIntradayResponse struct {
	MetaData map[string]string `json:"Meta Data"`
	TimeSeries map[string]struct {
		Open   string `json:"1. open"`
		High   string `json:"2. high"`
		Low    string `json:"3. low"`
		Close  string `json:"4. close"`
		Volume string `json:"5. volume"`
	} `json:"Time Series (1min)"`
}

// TwelveDataResponse represents the response from Twelve Data API
type TwelveDataResponse struct {
	Symbol    string `json:"symbol"`
	Name      string `json:"name"`
	Exchange  string `json:"exchange"`
	Currency  string `json:"currency"`
	Datetime  string `json:"datetime"`
	Timestamp int64  `json:"timestamp"`
	Price     string `json:"price"`
}

// TwelveDataQuoteResponse represents the response from Twelve Data quote endpoint
type TwelveDataQuoteResponse struct {
	Symbol           string `json:"symbol"`
	Name             string `json:"name"`
	Exchange         string `json:"exchange"`
	Currency         string `json:"currency"`
	Datetime         string `json:"datetime"`
	Timestamp        int64  `json:"timestamp"`
	Open             string `json:"open"`
	High             string `json:"high"`
	Low              string `json:"low"`
	Close            string `json:"close"`
	Volume           string `json:"volume"`
	PreviousClose    string `json:"previous_close"`
	Change           string `json:"change"`
	PercentChange    string `json:"percent_change"`
	AverageVolume    string `json:"average_volume,omitempty"`
	IsMarketOpen     bool   `json:"is_market_open"`
	FiftyTwoWeek     *struct {
		Low  string `json:"low"`
		High string `json:"high"`
	} `json:"fifty_two_week,omitempty"`
}

// TwelveDataPriceProvider provides real stock prices from Twelve Data API
type TwelveDataPriceProvider struct {
	apiKey        string
	client        *http.Client
	db            *sql.DB
	marketService *MarketHoursService
	config        *config.ApiConfig
	baseURL       string
	mu            sync.Mutex // Protects against concurrent price updates for the same symbol
	updateMap     map[string]bool // Tracks which symbols are currently being updated
}

// AlphaVantagePriceProvider provides real stock prices from Alpha Vantage API
type AlphaVantagePriceProvider struct {
	apiKey        string
	client        *http.Client
	db            *sql.DB
	marketService *MarketHoursService
	config        *config.ApiConfig
	baseURL       string
	mu            sync.Mutex // Protects against concurrent price updates for the same symbol
	updateMap     map[string]bool // Tracks which symbols are currently being updated
}

// NewTwelveDataPriceProvider creates a new Twelve Data price provider
func NewTwelveDataPriceProvider(apiKey string, db *sql.DB, marketService *MarketHoursService, cfg *config.ApiConfig) *TwelveDataPriceProvider {
	return &TwelveDataPriceProvider{
		apiKey:        apiKey,
		client:        &http.Client{Timeout: 30 * time.Second},
		db:            db,
		marketService: marketService,
		config:        cfg,
		baseURL:       "https://api.twelvedata.com",
		updateMap:     make(map[string]bool),
	}
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
		updateMap:     make(map[string]bool),
	}
}

// GetCurrentPrice gets the current price for a symbol with market-aware caching
func (av *AlphaVantagePriceProvider) GetCurrentPrice(symbol string) (float64, error) {
	return av.GetCurrentPriceWithForce(symbol, false)
}

// GetCurrentPriceWithForce gets the current price for a symbol with optional force refresh
func (av *AlphaVantagePriceProvider) GetCurrentPriceWithForce(symbol string, forceRefresh bool) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	if symbol == "" {
		return 0, fmt.Errorf("symbol cannot be empty")
	}

	// Prevent concurrent updates for the same symbol
	av.mu.Lock()
	if av.updateMap[symbol] {
		av.mu.Unlock()
		// If another goroutine is already updating this symbol, just get cached price
		cachedPrice, _, err := av.getCachedPrice(symbol)
		if err == nil {
			fmt.Printf("DEBUG: Concurrent update detected for %s, returning cached price %.2f\n", symbol, cachedPrice)
			return cachedPrice, nil
		}
		// If no cache, wait a bit and try again
		time.Sleep(100 * time.Millisecond)
		return av.getCachedPriceWithFallback(symbol)
	}
	av.updateMap[symbol] = true
	av.mu.Unlock()

	// Ensure cleanup on exit
	defer func() {
		av.mu.Lock()
		delete(av.updateMap, symbol)
		av.mu.Unlock()
	}()

	fmt.Printf("DEBUG: Alpha Vantage GetCurrentPriceWithForce called for %s, force: %t\n", symbol, forceRefresh)

	// Check cached price first
	cachedPrice, lastUpdate, err := av.getCachedPrice(symbol)
	var hasCache = err == nil
	
	fmt.Printf("DEBUG: Cache check for %s - hasCache: %t, cachedPrice: %.2f, lastUpdate: %v, error: %v\n", symbol, hasCache, cachedPrice, lastUpdate, err)
	
	if hasCache && !forceRefresh {
		// Use market-aware caching logic for regular refresh (not force)
		shouldRefresh := av.marketService.ShouldRefreshPrices(lastUpdate, av.config.CacheRefreshInterval)
		fmt.Printf("DEBUG: Cache decision for %s - shouldRefresh: %t, cacheAge: %v\n", symbol, shouldRefresh, time.Since(lastUpdate))
		
		if !shouldRefresh {
			fmt.Printf("DEBUG: Using cached price %.2f for %s (last updated: %v)\n", cachedPrice, symbol, lastUpdate)
			return cachedPrice, nil
		} else {
			fmt.Printf("DEBUG: Cache expired for %s, making API call\n", symbol)
		}
	} else if forceRefresh {
		fmt.Printf("DEBUG: Force refresh requested for %s - bypassing cache\n", symbol)
	} else {
		fmt.Printf("DEBUG: No cache found for %s, making API call\n", symbol)
	}

	// Check rate limiting with different rules for force vs regular refresh
	if forceRefresh {
		// Force refresh has more lenient rate limiting but still has limits
		if !av.canMakeForceRefreshAPICall() {
			if hasCache {
				fmt.Printf("DEBUG: Force refresh rate limited for %s, using cached price\n", symbol)
				return cachedPrice, nil
			}
			return 0, fmt.Errorf("force refresh rate limit exceeded for %s - please wait before forcing another refresh", symbol)
		}
	} else {
		// Regular refresh follows standard rate limiting
		if !av.canMakeAPICall() {
			if hasCache {
				return cachedPrice, nil
			}
			return 0, fmt.Errorf("rate limit exceeded and no cached price available for %s. Please try again later when rate limits reset", symbol)
		}
	}

	// Try intraday data first if market is open or we're forcing refresh for fresher data
	isMarketOpen := av.marketService.IsMarketOpen()
	if isMarketOpen || forceRefresh {
		fmt.Printf("INFO: Attempting to get current data using TIME_SERIES_INTRADAY for %s (market open: %t, force: %t)\n", symbol, isMarketOpen, forceRefresh)
		if price, err := av.getCurrentPriceFromIntraday(symbol); err == nil {
			fmt.Printf("INFO: Successfully got current price %.2f from intraday data for %s\n", price, symbol)
			// Cache the result
			if cacheErr := av.cachePrice(symbol, price); cacheErr != nil {
				fmt.Printf("ERROR: Failed to cache intraday price for %s: %v\n", symbol, cacheErr)
			}
			av.recordAPICall()
			return price, nil
		} else {
			fmt.Printf("WARNING: Failed to get intraday data for %s: %v, falling back to GLOBAL_QUOTE\n", symbol, err)
		}
	}

	// Fetch from Alpha Vantage GLOBAL_QUOTE API as fallback
	url := fmt.Sprintf("%s?function=GLOBAL_QUOTE&symbol=%s&apikey=%s", av.baseURL, symbol, av.apiKey)
	// Don't log the full URL with API key for security
	fmt.Printf("INFO: Making Alpha Vantage GLOBAL_QUOTE API call for %s (force: %t)\n", symbol, forceRefresh)
	fmt.Printf("DEBUG: API URL: %s?function=GLOBAL_QUOTE&symbol=%s&apikey=***HIDDEN***\n", av.baseURL, symbol)

	resp, err := av.client.Get(url)
	if err != nil {
		fmt.Printf("ERROR: Alpha Vantage HTTP request failed for %s: %v\n", symbol, err)
		// Return cached price on API failure if we have one
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to HTTP error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to fetch price from Alpha Vantage and no cached price available for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("ERROR: Alpha Vantage API returned HTTP %d for %s\n", resp.StatusCode, symbol)
		// Return cached price on API error if we have one
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to HTTP %d error\n", cachedPrice, symbol, resp.StatusCode)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("Alpha Vantage API returned status %d for %s and no cached price available", resp.StatusCode, symbol)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("ERROR: Failed to read Alpha Vantage response body for %s: %v\n", symbol, err)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to response read error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to read response body for %s and no cached price available: %w", symbol, err)
	}

	responseStr := string(body)
	fmt.Printf("INFO: Alpha Vantage response received for %s (length: %d bytes)\n", symbol, len(body))
	
	// Check for common Alpha Vantage error responses
	if strings.Contains(responseStr, "Invalid API call") {
		fmt.Printf("ERROR: Alpha Vantage API call invalid for %s - check symbol or API key\n", symbol)
		return 0, fmt.Errorf("invalid API call for symbol %s - check symbol format", symbol)
	}
	if strings.Contains(responseStr, "rate limit") || strings.Contains(responseStr, "exceeded") {
		fmt.Printf("ERROR: Alpha Vantage rate limit exceeded for %s\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to rate limit\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("rate limit exceeded for %s", symbol)
	}
	if strings.Contains(responseStr, "{\"Error Message\"") {
		fmt.Printf("ERROR: Alpha Vantage returned error message for %s: %s\n", symbol, responseStr)
		return 0, fmt.Errorf("Alpha Vantage error for %s: %s", symbol, responseStr)
	}
	
	// Log response for debugging (truncated for readability)
	if len(responseStr) > 500 {
		fmt.Printf("DEBUG: Alpha Vantage response for %s: %s...(truncated)\n", symbol, responseStr[:500])
	} else {
		fmt.Printf("DEBUG: Alpha Vantage response for %s: %s\n", symbol, responseStr)
	}

	var response AlphaVantageResponse
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Printf("ERROR: Failed to parse Alpha Vantage JSON response for %s: %v\n", symbol, err)
		fmt.Printf("ERROR: Raw response causing parse error: %s\n", responseStr)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to JSON parse error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse Alpha Vantage response for %s and no cached price available: %w", symbol, err)
	}

	// Debug log the parsed response structure
	fmt.Printf("INFO: Alpha Vantage parsed response for %s - Symbol: %s, Price: %s, Trading Day: %s\n",
		symbol, response.GlobalQuote.Symbol, response.GlobalQuote.Price, response.GlobalQuote.LatestTradingDay)
	
	// Check if the data is stale
	tradingDay := response.GlobalQuote.LatestTradingDay
	if tradingDay != "" {
		if tradingDate, err := time.Parse("2006-01-02", tradingDay); err == nil {
			daysSince := int(time.Since(tradingDate).Hours() / 24)
			fmt.Printf("INFO: Alpha Vantage data for %s is %d days old (trading day: %s)\n", symbol, daysSince, tradingDay)
			
			// Check if data is too stale during market hours
			isMarketOpen := av.marketService.IsMarketOpen()
			maxStaleDays := 3
			if isMarketOpen {
				maxStaleDays = 1 // More strict during market hours
			}
			
			if daysSince > maxStaleDays {
				fmt.Printf("ERROR: Alpha Vantage data for %s is too stale (%d days old, max allowed: %d)\n", symbol, daysSince, maxStaleDays)
				fmt.Printf("INFO: This is likely due to Alpha Vantage free tier limitations (end-of-day data only)\n")
				fmt.Printf("INFO: Alpha Vantage free tier provides last trading day close (trading day: %s)\n", tradingDay)
				
				// If we have cached price and API data is too stale, prefer cache if it's newer
				if hasCache && time.Since(lastUpdate) < time.Duration(daysSince)*24*time.Hour {
					fmt.Printf("INFO: Using cached price %.2f for %s because it's fresher than Alpha Vantage data\n", cachedPrice, symbol)
					return cachedPrice, nil
				}
				
				// For free tier, we accept the stale data but warn the user
				fmt.Printf("WARNING: Proceeding with stale Alpha Vantage data due to free tier limitations\n")
			}
		}
	}
	
	// Validate the response has the expected structure
	if response.GlobalQuote.Symbol == "" && response.GlobalQuote.Price == "" {
		fmt.Printf("ERROR: Alpha Vantage response for %s appears to be empty or malformed\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to empty response\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("empty or malformed response from Alpha Vantage for %s", symbol)
	}

	// Extract price from response
	priceStr := response.GlobalQuote.Price
	if priceStr == "" {
		fmt.Printf("ERROR: No price data found in Alpha Vantage response for %s\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to missing price data\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("no price data found for symbol %s and no cached price available", symbol)
	}

	price := 0.0
	if _, err := fmt.Sscanf(priceStr, "%f", &price); err != nil {
		fmt.Printf("DEBUG: Failed to parse price string '%s' for %s: %v\n", priceStr, symbol, err)
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse price %s for symbol %s and no cached price available: %w", priceStr, symbol, err)
	}

	fmt.Printf("DEBUG: Successfully parsed price %.2f for %s from Alpha Vantage (force=%t)\n", price, symbol, forceRefresh)

	// Cache the result with current timestamp
	if err := av.cachePrice(symbol, price); err != nil {
		fmt.Printf("ERROR: Failed to cache price for %s: %v\n", symbol, err)
	} else {
		fmt.Printf("DEBUG: Successfully cached price %.2f for %s\n", price, symbol)
	}

	// Record API usage
	av.recordAPICall()

	return price, nil
}

// getCurrentPriceFromIntraday gets current price using TIME_SERIES_INTRADAY endpoint
func (av *AlphaVantagePriceProvider) getCurrentPriceFromIntraday(symbol string) (float64, error) {
	// Use 1min interval for most current data
	url := fmt.Sprintf("%s?function=TIME_SERIES_INTRADAY&symbol=%s&interval=1min&apikey=%s", av.baseURL, symbol, av.apiKey)
	fmt.Printf("DEBUG: Making TIME_SERIES_INTRADAY API call for %s\n", symbol)
	
	resp, err := av.client.Get(url)
	if err != nil {
		return 0, fmt.Errorf("intraday API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("intraday API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read intraday response: %w", err)
	}

	responseStr := string(body)
	
	// Check for common Alpha Vantage error responses
	if strings.Contains(responseStr, "Invalid API call") {
		return 0, fmt.Errorf("invalid intraday API call for symbol %s", symbol)
	}
	if strings.Contains(responseStr, "rate limit") || strings.Contains(responseStr, "exceeded") {
		return 0, fmt.Errorf("rate limit exceeded for intraday data")
	}
	if strings.Contains(responseStr, "{\"Error Message\"") {
		return 0, fmt.Errorf("Alpha Vantage intraday error: %s", responseStr)
	}

	var response AlphaVantageIntradayResponse
	if err := json.Unmarshal(body, &response); err != nil {
		truncated := responseStr
		if len(responseStr) > 200 {
			truncated = responseStr[:200]
		}
		fmt.Printf("DEBUG: Failed to parse intraday JSON, response: %s\n", truncated)
		return 0, fmt.Errorf("failed to parse intraday response: %w", err)
	}

	// Get the most recent timestamp
	var latestTime time.Time
	var latestPrice float64
	
	for timestamp, data := range response.TimeSeries {
		if parsedTime, err := time.Parse("2006-01-02 15:04:05", timestamp); err == nil {
			if parsedTime.After(latestTime) {
				var price float64
				if _, parseErr := fmt.Sscanf(data.Close, "%f", &price); parseErr == nil && price > 0 {
					latestTime = parsedTime
					latestPrice = price
					fmt.Printf("DEBUG: Found intraday data point for %s at %s: %.2f\n", symbol, timestamp, latestPrice)
				}
			}
		}
	}

	if latestTime.IsZero() || latestPrice <= 0 {
		return 0, fmt.Errorf("no valid price data found in intraday response")
	}

	// Check if the data is current (within last few hours during market hours)
	age := time.Since(latestTime)
	if age > 4*time.Hour {
		fmt.Printf("WARNING: Intraday data for %s is %.1f hours old (timestamp: %s)\n", symbol, age.Hours(), latestTime.Format("2006-01-02 15:04:05"))
		
		// If data is more than 24 hours old, it's likely Alpha Vantage free tier limitation
		if age > 24*time.Hour {
			fmt.Printf("ERROR: Alpha Vantage free tier limitation - data for %s is %.1f hours old. Consider upgrading to premium for real-time data.\n", symbol, age.Hours())
			fmt.Printf("INFO: Alpha Vantage free tier provides end-of-day data only. Last trading day data: %.2f\n", latestPrice)
		}
	} else {
		fmt.Printf("INFO: Got current intraday price %.2f for %s (age: %.0f minutes)\n", latestPrice, symbol, age.Minutes())
	}

	return latestPrice, nil
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

	fmt.Printf("DEBUG: Checking cache for %s in stock_prices table\n", symbol)
	
	// First, let's check what's actually in the stock_prices table
	countQuery := `SELECT COUNT(*) FROM stock_prices WHERE symbol = $1`
	var count int
	countErr := av.db.QueryRow(countQuery, symbol).Scan(&count)
	if countErr != nil {
		fmt.Printf("ERROR: Failed to count stock_prices for %s: %v\n", symbol, countErr)
	} else {
		fmt.Printf("SQL DEBUG: Found %d rows for symbol %s in stock_prices table\n", count, symbol)
	}
	
	// Also check total count in table
	totalCountQuery := `SELECT COUNT(*) FROM stock_prices`
	var totalCount int
	totalCountErr := av.db.QueryRow(totalCountQuery).Scan(&totalCount)
	if totalCountErr != nil {
		fmt.Printf("ERROR: Failed to count total stock_prices: %v\n", totalCountErr)
	} else {
		fmt.Printf("SQL DEBUG: Total rows in stock_prices table: %d\n", totalCount)
	}
	
	var price float64
	var timestamp time.Time
	err := av.db.QueryRow(query, symbol).Scan(&price, &timestamp)
	
	if err == sql.ErrNoRows {
		fmt.Printf("DEBUG: No cached price found for %s in stock_prices table (confirmed by SQL query)\n", symbol)
		return 0, time.Time{}, fmt.Errorf("no cached price found")
	}
	if err != nil {
		fmt.Printf("ERROR: Database error getting cached price for %s: %v\n", symbol, err)
		return 0, time.Time{}, err
	}

	fmt.Printf("DEBUG: Found cached price for %s: %.2f (timestamp: %v)\n", symbol, price, timestamp)
	
	// Also log if price exists in stock_holdings for debugging cache sources
	var stockHoldingPrice sql.NullFloat64
	stockHoldingQuery := `SELECT current_price FROM stock_holdings WHERE symbol = $1 LIMIT 1`
	stockErr := av.db.QueryRow(stockHoldingQuery, symbol).Scan(&stockHoldingPrice)
	if stockErr == nil && stockHoldingPrice.Valid {
		fmt.Printf("DEBUG: Also found price %.2f for %s in stock_holdings.current_price\n", stockHoldingPrice.Float64, symbol)
	}
	
	return price, timestamp, nil
}

// getCachedPriceWithFallback attempts to get cached price with retry logic
func (av *AlphaVantagePriceProvider) getCachedPriceWithFallback(symbol string) (float64, error) {
	for i := 0; i < 3; i++ {
		cachedPrice, _, err := av.getCachedPrice(symbol)
		if err == nil {
			return cachedPrice, nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return 0, fmt.Errorf("no cached price available for %s after concurrent update", symbol)
}

// cachePrice stores price in database with comprehensive error handling
func (av *AlphaVantagePriceProvider) cachePrice(symbol string, price float64) error {
	if price <= 0 {
		return fmt.Errorf("invalid price %.2f for symbol %s - prices must be positive", price, symbol)
	}

	query := `
		INSERT INTO stock_prices (symbol, price, timestamp, source)
		VALUES ($1, $2, $3, $4)
	`

	result, err := av.db.Exec(query, symbol, price, time.Now(), "alphavantage")
	if err != nil {
		return fmt.Errorf("failed to insert price for %s: %w", symbol, err)
	}

	// Verify the insert was successful
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to verify insert for %s: %w", symbol, err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("unexpected rows affected (%d) when inserting price for %s", rowsAffected, symbol)
	}

	fmt.Printf("DEBUG: Successfully cached price %.2f for %s (verified %d row affected)\n", price, symbol, rowsAffected)
	return nil
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

// canMakeForceRefreshAPICall checks if we can make a force refresh API call
// Force refresh has more lenient limits but still prevents abuse
func (av *AlphaVantagePriceProvider) canMakeForceRefreshAPICall() bool {
	// Check daily limit - force refresh gets 50% more calls
	today := time.Now().Format("2006-01-02")
	dailyCount := av.getAPICallCount(today)
	forceRefreshDailyLimit := int(float64(av.config.AlphaVantageDailyLimit) * 1.5)
	
	if dailyCount >= forceRefreshDailyLimit {
		fmt.Printf("DEBUG: Force refresh daily limit exceeded: %d >= %d\n", dailyCount, forceRefreshDailyLimit)
		return false
	}

	// Check rate limit - force refresh gets double the per-minute limit
	lastMinute := time.Now().Add(-1 * time.Minute)
	recentCount := av.getAPICallCountSince(lastMinute)
	forceRefreshRateLimit := av.config.AlphaVantageRateLimit * 2
	
	canMake := recentCount < forceRefreshRateLimit
	fmt.Printf("DEBUG: Force refresh rate check: %d < %d = %t\n", recentCount, forceRefreshRateLimit, canMake)
	return canMake
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

// TwelveData Implementation

// GetCurrentPrice gets the current price for a symbol
func (td *TwelveDataPriceProvider) GetCurrentPrice(symbol string) (float64, error) {
	return td.GetCurrentPriceWithForce(symbol, false)
}

// GetCurrentPriceWithForce gets the current price for a symbol with optional force refresh
func (td *TwelveDataPriceProvider) GetCurrentPriceWithForce(symbol string, forceRefresh bool) (float64, error) {
	symbol = strings.ToUpper(strings.TrimSpace(symbol))

	if symbol == "" {
		return 0, fmt.Errorf("symbol cannot be empty")
	}

	// Prevent concurrent updates for the same symbol
	td.mu.Lock()
	if td.updateMap[symbol] {
		td.mu.Unlock()
		// If another goroutine is already updating this symbol, just get cached price
		cachedPrice, _, err := td.getCachedPrice(symbol)
		if err == nil {
			fmt.Printf("DEBUG: Concurrent update detected for %s, returning cached price %.2f\n", symbol, cachedPrice)
			return cachedPrice, nil
		}
		// If no cache, wait a bit and try again
		time.Sleep(100 * time.Millisecond)
		return td.getCachedPriceWithFallback(symbol)
	}
	td.updateMap[symbol] = true
	td.mu.Unlock()

	// Ensure cleanup on exit
	defer func() {
		td.mu.Lock()
		delete(td.updateMap, symbol)
		td.mu.Unlock()
	}()

	fmt.Printf("DEBUG: Twelve Data GetCurrentPriceWithForce called for %s, force: %t\n", symbol, forceRefresh)

	// Check cached price first
	cachedPrice, lastUpdate, err := td.getCachedPrice(symbol)
	var hasCache = err == nil
	
	fmt.Printf("DEBUG: Cache check for %s - hasCache: %t, cachedPrice: %.2f, lastUpdate: %v, error: %v\n", symbol, hasCache, cachedPrice, lastUpdate, err)
	
	if hasCache && !forceRefresh {
		// Use market-aware caching logic for regular refresh (not force)
		shouldRefresh := td.marketService.ShouldRefreshPrices(lastUpdate, td.config.CacheRefreshInterval)
		fmt.Printf("DEBUG: Cache decision for %s - shouldRefresh: %t, cacheAge: %v\n", symbol, shouldRefresh, time.Since(lastUpdate))
		
		if !shouldRefresh {
			fmt.Printf("DEBUG: Using cached price %.2f for %s (last updated: %v)\n", cachedPrice, symbol, lastUpdate)
			return cachedPrice, nil
		} else {
			fmt.Printf("DEBUG: Cache expired for %s, making API call\n", symbol)
		}
	} else if forceRefresh {
		fmt.Printf("DEBUG: Force refresh requested for %s - bypassing cache\n", symbol)
	} else {
		fmt.Printf("DEBUG: No cache found for %s, making API call\n", symbol)
	}

	// Check rate limiting
	if !td.canMakeAPICall() {
		if hasCache {
			fmt.Printf("DEBUG: Rate limited for %s, using cached price\n", symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("rate limit exceeded and no cached price available for %s", symbol)
	}

	// Fetch from Twelve Data API
	url := fmt.Sprintf("%s/quote?symbol=%s&apikey=%s", td.baseURL, symbol, td.apiKey)
	fmt.Printf("INFO: Making Twelve Data API call for %s (force: %t)\n", symbol, forceRefresh)
	fmt.Printf("DEBUG: API URL: %s/quote?symbol=%s&apikey=***HIDDEN***\n", td.baseURL, symbol)

	resp, err := td.client.Get(url)
	if err != nil {
		fmt.Printf("ERROR: Twelve Data HTTP request failed for %s: %v\n", symbol, err)
		// Return cached price on API failure if we have one
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to HTTP error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to fetch price from Twelve Data and no cached price available for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("ERROR: Twelve Data API returned HTTP %d for %s\n", resp.StatusCode, symbol)
		// Return cached price on API error if we have one
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to HTTP %d error\n", cachedPrice, symbol, resp.StatusCode)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("Twelve Data API returned status %d for %s and no cached price available", resp.StatusCode, symbol)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("ERROR: Failed to read Twelve Data response body for %s: %v\n", symbol, err)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to response read error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to read response body for %s and no cached price available: %w", symbol, err)
	}

	responseStr := string(body)
	fmt.Printf("INFO: Twelve Data response received for %s (length: %d bytes)\n", symbol, len(body))
	
	// Check for common Twelve Data error responses
	if strings.Contains(responseStr, "Invalid API call") || strings.Contains(responseStr, "\"code\":400") {
		fmt.Printf("ERROR: Twelve Data API call invalid for %s - check symbol or API key\n", symbol)
		return 0, fmt.Errorf("invalid API call for symbol %s - check symbol format", symbol)
	}
	if strings.Contains(responseStr, "rate limit") || strings.Contains(responseStr, "exceeded") || strings.Contains(responseStr, "\"code\":429") {
		fmt.Printf("ERROR: Twelve Data rate limit exceeded for %s\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to rate limit\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("rate limit exceeded for %s", symbol)
	}
	if strings.Contains(responseStr, "\"code\":") && !strings.Contains(responseStr, "\"code\":200") {
		fmt.Printf("ERROR: Twelve Data returned error for %s: %s\n", symbol, responseStr)
		return 0, fmt.Errorf("Twelve Data error for %s: %s", symbol, responseStr)
	}
	
	// Log response for debugging (truncated for readability)
	if len(responseStr) > 500 {
		fmt.Printf("DEBUG: Twelve Data response for %s: %s...(truncated)\n", symbol, responseStr[:500])
	} else {
		fmt.Printf("DEBUG: Twelve Data response for %s: %s\n", symbol, responseStr)
	}

	var response TwelveDataQuoteResponse
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Printf("ERROR: Failed to parse Twelve Data JSON response for %s: %v\n", symbol, err)
		fmt.Printf("ERROR: Raw response causing parse error: %s\n", responseStr)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to JSON parse error\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse Twelve Data response for %s and no cached price available: %w", symbol, err)
	}

	// Debug log the parsed response structure
	fmt.Printf("INFO: Twelve Data parsed response for %s - Symbol: %s, Close: %s, Datetime: %s\n",
		symbol, response.Symbol, response.Close, response.Datetime)
	
	// Check data freshness
	if response.Datetime != "" {
		if parsedTime, err := time.Parse("2006-01-02 15:04:05", response.Datetime); err == nil {
			age := time.Since(parsedTime)
			fmt.Printf("INFO: Twelve Data price for %s is %.1f minutes old (datetime: %s)\n", symbol, age.Minutes(), response.Datetime)
		}
	}
	
	// Validate the response has the expected structure
	if response.Symbol == "" && response.Close == "" {
		fmt.Printf("ERROR: Twelve Data response for %s appears to be empty or malformed\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to empty response\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("empty or malformed response from Twelve Data for %s", symbol)
	}

	// Extract price from response
	priceStr := response.Close
	if priceStr == "" {
		fmt.Printf("ERROR: No price data found in Twelve Data response for %s\n", symbol)
		if hasCache && cachedPrice > 0 {
			fmt.Printf("INFO: Using cached price %.2f for %s due to missing price data\n", cachedPrice, symbol)
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("no price data found for symbol %s and no cached price available", symbol)
	}

	price := 0.0
	if _, err := fmt.Sscanf(priceStr, "%f", &price); err != nil {
		fmt.Printf("DEBUG: Failed to parse price string '%s' for %s: %v\n", priceStr, symbol, err)
		if hasCache && cachedPrice > 0 {
			return cachedPrice, nil
		}
		return 0, fmt.Errorf("failed to parse price %s for symbol %s and no cached price available: %w", priceStr, symbol, err)
	}

	fmt.Printf("DEBUG: Successfully parsed price %.2f for %s from Twelve Data (force=%t)\n", price, symbol, forceRefresh)

	// Cache the result with current timestamp
	if err := td.cachePrice(symbol, price); err != nil {
		fmt.Printf("ERROR: Failed to cache price for %s: %v\n", symbol, err)
	} else {
		fmt.Printf("DEBUG: Successfully cached price %.2f for %s\n", price, symbol)
	}

	// Record API usage
	td.recordAPICall()

	return price, nil
}

// GetMultiplePrices gets prices for multiple symbols efficiently
func (td *TwelveDataPriceProvider) GetMultiplePrices(symbols []string) (map[string]float64, error) {
	results := make(map[string]float64)
	var errors []string

	for _, symbol := range symbols {
		price, err := td.GetCurrentPrice(symbol)
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
func (td *TwelveDataPriceProvider) GetProviderName() string {
	return "Twelve Data"
}

// getCachedPrice retrieves cached price from database
func (td *TwelveDataPriceProvider) getCachedPrice(symbol string) (float64, time.Time, error) {
	query := `
		SELECT price, timestamp 
		FROM stock_prices 
		WHERE symbol = $1 
		ORDER BY timestamp DESC 
		LIMIT 1
	`

	fmt.Printf("DEBUG: Checking cache for %s in stock_prices table\n", symbol)
	
	// First, let's check what's actually in the stock_prices table
	countQuery := `SELECT COUNT(*) FROM stock_prices WHERE symbol = $1`
	var count int
	countErr := td.db.QueryRow(countQuery, symbol).Scan(&count)
	if countErr != nil {
		fmt.Printf("ERROR: Failed to count stock_prices for %s: %v\n", symbol, countErr)
	} else {
		fmt.Printf("SQL DEBUG: Found %d rows for symbol %s in stock_prices table\n", count, symbol)
	}
	
	// Also check total count in table
	totalCountQuery := `SELECT COUNT(*) FROM stock_prices`
	var totalCount int
	totalCountErr := td.db.QueryRow(totalCountQuery).Scan(&totalCount)
	if totalCountErr != nil {
		fmt.Printf("ERROR: Failed to count total stock_prices: %v\n", totalCountErr)
	} else {
		fmt.Printf("SQL DEBUG: Total rows in stock_prices table: %d\n", totalCount)
	}
	
	var price float64
	var timestamp time.Time
	err := td.db.QueryRow(query, symbol).Scan(&price, &timestamp)
	
	if err == sql.ErrNoRows {
		fmt.Printf("DEBUG: No cached price found for %s in stock_prices table (confirmed by SQL query)\n", symbol)
		return 0, time.Time{}, fmt.Errorf("no cached price found")
	}
	if err != nil {
		fmt.Printf("ERROR: Database error getting cached price for %s: %v\n", symbol, err)
		return 0, time.Time{}, err
	}

	fmt.Printf("DEBUG: Found cached price for %s: %.2f (timestamp: %v)\n", symbol, price, timestamp)
	
	// Also log if price exists in stock_holdings for debugging cache sources
	var stockHoldingPrice sql.NullFloat64
	stockHoldingQuery := `SELECT current_price FROM stock_holdings WHERE symbol = $1 LIMIT 1`
	stockErr := td.db.QueryRow(stockHoldingQuery, symbol).Scan(&stockHoldingPrice)
	if stockErr == nil && stockHoldingPrice.Valid {
		fmt.Printf("DEBUG: Also found price %.2f for %s in stock_holdings.current_price\n", stockHoldingPrice.Float64, symbol)
	}
	
	return price, timestamp, nil
}

// getCachedPriceWithFallback attempts to get cached price with retry logic
func (td *TwelveDataPriceProvider) getCachedPriceWithFallback(symbol string) (float64, error) {
	for i := 0; i < 3; i++ {
		cachedPrice, _, err := td.getCachedPrice(symbol)
		if err == nil {
			return cachedPrice, nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return 0, fmt.Errorf("no cached price available for %s after concurrent update", symbol)
}

// cachePrice stores price in database with comprehensive error handling
func (td *TwelveDataPriceProvider) cachePrice(symbol string, price float64) error {
	if price <= 0 {
		return fmt.Errorf("invalid price %.2f for symbol %s - prices must be positive", price, symbol)
	}

	query := `
		INSERT INTO stock_prices (symbol, price, timestamp, source)
		VALUES ($1, $2, $3, $4)
	`

	result, err := td.db.Exec(query, symbol, price, time.Now(), "twelvedata")
	if err != nil {
		return fmt.Errorf("failed to insert price for %s: %w", symbol, err)
	}

	// Verify the insert was successful
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to verify insert for %s: %w", symbol, err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("unexpected rows affected (%d) when inserting price for %s", rowsAffected, symbol)
	}

	fmt.Printf("DEBUG: Successfully cached price %.2f for %s (verified %d row affected)\n", price, symbol, rowsAffected)
	return nil
}

// canMakeAPICall checks if we can make an API call based on rate limits
func (td *TwelveDataPriceProvider) canMakeAPICall() bool {
	// Check daily limit (configurable, default 800 calls/day for free tier)
	today := time.Now().Format("2006-01-02")
	dailyCount := td.getAPICallCount(today)
	
	if dailyCount >= td.config.TwelveDataDailyLimit {
		fmt.Printf("DEBUG: Twelve Data daily limit exceeded: %d >= %d\n", dailyCount, td.config.TwelveDataDailyLimit)
		return false
	}

	// Check rate limit (configurable, default 8 calls per minute for free tier)
	lastMinute := time.Now().Add(-1 * time.Minute)
	recentCount := td.getAPICallCountSince(lastMinute)
	
	canMake := recentCount < td.config.TwelveDataRateLimit
	fmt.Printf("DEBUG: Twelve Data rate check: %d < %d = %t\n", recentCount, td.config.TwelveDataRateLimit, canMake)
	return canMake
}

// getAPICallCount gets the number of API calls made today
func (td *TwelveDataPriceProvider) getAPICallCount(date string) int {
	query := `
		SELECT COUNT(*) 
		FROM stock_prices 
		WHERE source = 'twelvedata' 
		AND DATE(timestamp) = $1
	`

	var count int
	err := td.db.QueryRow(query, date).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// getAPICallCountSince gets the number of API calls made since a specific time
func (td *TwelveDataPriceProvider) getAPICallCountSince(since time.Time) int {
	query := `
		SELECT COUNT(*) 
		FROM stock_prices 
		WHERE source = 'twelvedata' 
		AND timestamp > $1
	`

	var count int
	err := td.db.QueryRow(query, since).Scan(&count)
	if err != nil {
		return 0
	}
	return count
}

// recordAPICall records that an API call was made (this is implicit when caching prices)
func (td *TwelveDataPriceProvider) recordAPICall() {
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

// NewPriceServiceWithProviders creates a price service with intelligent provider selection
func NewPriceServiceWithProviders(db *sql.DB, marketService *MarketHoursService, cfg *config.ApiConfig) *PriceService {
	// Try to create primary provider (Twelve Data by default)
	if cfg.PrimaryPriceProvider == "twelvedata" && cfg.TwelveDataAPIKey != "" {
		fmt.Printf("INFO: Initializing Twelve Data as primary provider (API key: %d chars)\n", len(cfg.TwelveDataAPIKey))
		twelveDataProvider := NewTwelveDataPriceProvider(cfg.TwelveDataAPIKey, db, marketService, cfg)
		
		// Return Twelve Data provider without immediate testing
		// Let it fail gracefully during actual price requests if needed
		fmt.Printf("INFO: Twelve Data provider initialized successfully\n")
		return &PriceService{
			provider: twelveDataProvider,
		}
	}
	
	// Try fallback provider (Alpha Vantage)
	if cfg.FallbackPriceProvider == "alphavantage" && cfg.AlphaVantageAPIKey != "" {
		fmt.Printf("INFO: Initializing Alpha Vantage as fallback provider (API key: %d chars)\n", len(cfg.AlphaVantageAPIKey))
		alphaVantageProvider := NewAlphaVantagePriceProvider(cfg.AlphaVantageAPIKey, db, marketService, cfg)
		
		// Return Alpha Vantage provider without immediate testing
		fmt.Printf("INFO: Alpha Vantage provider initialized successfully\n")
		return &PriceService{
			provider: alphaVantageProvider,
		}
	}
	
	// If both providers failed or no API keys available, use mock
	fmt.Printf("WARNING: No working price providers available - using Mock Price Provider\n")
	fmt.Printf("WARNING: Stock prices will be simulated, not real market data\n")
	fmt.Printf("WARNING: Set TWELVE_DATA_API_KEY or ALPHA_VANTAGE_API_KEY environment variables to use real prices\n")
	return NewPriceService()
}

// NewPriceServiceWithAlphaVantage creates a price service with Alpha Vantage provider (legacy)
func NewPriceServiceWithAlphaVantage(apiKey string, db *sql.DB, marketService *MarketHoursService, cfg *config.ApiConfig) *PriceService {
	if apiKey == "" {
		fmt.Printf("WARNING: Alpha Vantage API key is empty - falling back to Mock Price Provider\n")
		fmt.Printf("WARNING: Stock prices will be simulated, not real market data\n")
		fmt.Printf("WARNING: Set ALPHA_VANTAGE_API_KEY environment variable to use real prices\n")
		return NewPriceService()
	}
	
	fmt.Printf("INFO: Initializing Alpha Vantage price provider with API key (length: %d)\n", len(apiKey))
	alphaVantageProvider := NewAlphaVantagePriceProvider(apiKey, db, marketService, cfg)
	
	// Test the provider immediately to verify it's working
	fmt.Printf("INFO: Testing Alpha Vantage connection...\n")
	testPrice, err := alphaVantageProvider.GetCurrentPrice("AAPL")
	if err != nil {
		fmt.Printf("ERROR: Alpha Vantage provider test failed: %v\n", err)
		fmt.Printf("WARNING: Falling back to Mock Price Provider due to API issues\n")
		return NewPriceService()
	}
	fmt.Printf("INFO: Alpha Vantage provider test successful - AAPL price: $%.2f\n", testPrice)
	
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

// GetCurrentPriceWithForce gets the current price for a symbol with optional force refresh
func (ps *PriceService) GetCurrentPriceWithForce(symbol string, forceRefresh bool) (float64, error) {
	// Check if provider supports force refresh interface
	if forceRefreshProvider, ok := ps.provider.(ForceRefreshProvider); ok {
		fmt.Printf("DEBUG: PriceService using ForceRefreshProvider for %s, force: %t\n", symbol, forceRefresh)
		return forceRefreshProvider.GetCurrentPriceWithForce(symbol, forceRefresh)
	}
	// Fallback to regular method for providers that don't support force refresh
	fmt.Printf("DEBUG: PriceService falling back to regular GetCurrentPrice for %s (provider doesn't support force refresh)\n", symbol)
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
	Symbol        string    `json:"symbol"`
	OldPrice      float64   `json:"old_price"`
	NewPrice      float64   `json:"new_price"`
	Updated       bool      `json:"updated"`
	Error         string    `json:"error,omitempty"`
	ErrorType     string    `json:"error_type,omitempty"` // "rate_limited", "api_error", "invalid_symbol", "cache_error"
	Timestamp     time.Time `json:"timestamp"`
	Source        string    `json:"source"`        // "api", "cache"
	PriceChange   float64   `json:"price_change"`  // Absolute change
	PriceChangePct float64  `json:"price_change_pct"` // Percentage change
	CacheAge      string    `json:"cache_age,omitempty"` // How old the previous cached price was
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
