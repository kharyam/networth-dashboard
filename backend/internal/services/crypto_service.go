package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// CryptoService handles cryptocurrency price data from CoinGecko
type CryptoService struct {
	db      *sql.DB
	client  *http.Client
	baseURL string
}

// CoinGeckoResponse represents the response from CoinGecko API
type CoinGeckoResponse struct {
	ID                string  `json:"id"`
	Symbol            string  `json:"symbol"`
	Name              string  `json:"name"`
	CurrentPrice      float64 `json:"current_price"`
	MarketCap         float64 `json:"market_cap"`
	TotalVolume       float64 `json:"total_volume"`
	PriceChange24h    float64 `json:"price_change_24h"`
	PriceChangePct24h float64 `json:"price_change_percentage_24h"`
	LastUpdated       string  `json:"last_updated"`
}

// CryptoPriceData represents crypto price information
type CryptoPriceData struct {
	Symbol         string    `json:"symbol"`
	PriceUSD       float64   `json:"price_usd"`
	PriceBTC       float64   `json:"price_btc"`
	MarketCapUSD   float64   `json:"market_cap_usd"`
	Volume24hUSD   float64   `json:"volume_24h_usd"`
	PriceChange24h float64   `json:"price_change_24h"`
	LastUpdated    time.Time `json:"last_updated"`
}

// CryptoPriceUpdateResult represents the result of a crypto price update operation
type CryptoPriceUpdateResult struct {
	Symbol         string    `json:"symbol"`
	OldPriceUSD    float64   `json:"old_price_usd"`
	NewPriceUSD    float64   `json:"new_price_usd"`
	OldPriceBTC    float64   `json:"old_price_btc"`
	NewPriceBTC    float64   `json:"new_price_btc"`
	Updated        bool      `json:"updated"`
	Error          string    `json:"error,omitempty"`
	ErrorType      string    `json:"error_type,omitempty"` // "rate_limited", "api_error", "invalid_symbol", "cache_error"
	Timestamp      time.Time `json:"timestamp"`
	Source         string    `json:"source"`        // "api", "cache"
	PriceChangeUSD float64   `json:"price_change_usd"`  // Absolute change in USD
	PriceChangePct float64   `json:"price_change_pct"` // Percentage change in USD
	CacheAge       string    `json:"cache_age,omitempty"` // How old the previous cached price was
}

// CryptoPriceRefreshSummary summarizes a bulk crypto price refresh operation
type CryptoPriceRefreshSummary struct {
	TotalSymbols   int                       `json:"total_symbols"`
	UpdatedSymbols int                       `json:"updated_symbols"`
	FailedSymbols  int                       `json:"failed_symbols"`
	Results        []CryptoPriceUpdateResult `json:"results"`
	ProviderName   string                    `json:"provider_name"`
	Timestamp      time.Time                 `json:"timestamp"`
	DurationMs     int64                     `json:"duration_ms"`
}

// NewCryptoService creates a new cryptocurrency service
func NewCryptoService(db *sql.DB) *CryptoService {
	return &CryptoService{
		db:      db,
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: "https://api.coingecko.com/api/v3",
	}
}

// GetPrice fetches current price for a single cryptocurrency
func (cs *CryptoService) GetPrice(symbol string) (*CryptoPriceData, error) {
	symbol = strings.ToLower(symbol)
	
	// Check if we have recent cached data (within 5 minutes)
	cached, err := cs.getCachedPrice(symbol)
	if err == nil && cached != nil && time.Since(cached.LastUpdated) < 5*time.Minute {
		return cached, nil
	}

	// Fetch from CoinGecko
	url := fmt.Sprintf("%s/simple/price?ids=%s&vs_currencies=usd,btc&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true", 
		cs.baseURL, cs.symbolToID(symbol))

	resp, err := cs.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch price from CoinGecko: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CoinGecko API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse the response - CoinGecko returns a map with coin ID as key
	var response map[string]map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse CoinGecko response: %w", err)
	}

	coinID := cs.symbolToID(symbol)
	priceData, exists := response[coinID]
	if !exists {
		return nil, fmt.Errorf("price data not found for symbol %s", symbol)
	}

	// Extract price information
	priceUSD, _ := priceData["usd"].(float64)
	priceBTC, _ := priceData["btc"].(float64)
	marketCapUSD, _ := priceData["usd_market_cap"].(float64)
	volume24hUSD, _ := priceData["usd_24h_vol"].(float64)
	priceChange24h, _ := priceData["usd_24h_change"].(float64)
	lastUpdatedUnix, _ := priceData["last_updated_at"].(float64)

	cryptoPrice := &CryptoPriceData{
		Symbol:         strings.ToUpper(symbol),
		PriceUSD:       priceUSD,
		PriceBTC:       priceBTC,
		MarketCapUSD:   marketCapUSD,
		Volume24hUSD:   volume24hUSD,
		PriceChange24h: priceChange24h,
		LastUpdated:    time.Unix(int64(lastUpdatedUnix), 0),
	}

	// Cache the result
	if err := cs.cachePrice(cryptoPrice); err != nil {
		// Log error but don't fail the request
		fmt.Printf("Failed to cache price for %s: %v\n", symbol, err)
	}

	return cryptoPrice, nil
}

// GetMultiplePrices fetches prices for multiple cryptocurrencies
func (cs *CryptoService) GetMultiplePrices(symbols []string) (map[string]*CryptoPriceData, error) {
	if len(symbols) == 0 {
		return make(map[string]*CryptoPriceData), nil
	}

	// Convert symbols to coin IDs and prepare request
	coinIDs := make([]string, 0, len(symbols))
	symbolToID := make(map[string]string)
	
	for _, symbol := range symbols {
		symbol = strings.ToLower(symbol)
		coinID := cs.symbolToID(symbol)
		coinIDs = append(coinIDs, coinID)
		symbolToID[coinID] = strings.ToUpper(symbol)
	}

	url := fmt.Sprintf("%s/simple/price?ids=%s&vs_currencies=usd,btc&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true", 
		cs.baseURL, strings.Join(coinIDs, ","))

	resp, err := cs.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch prices from CoinGecko: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CoinGecko API returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var response map[string]map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse CoinGecko response: %w", err)
	}

	results := make(map[string]*CryptoPriceData)
	
	for coinID, priceData := range response {
		symbol := symbolToID[coinID]
		
		priceUSD, _ := priceData["usd"].(float64)
		priceBTC, _ := priceData["btc"].(float64)
		marketCapUSD, _ := priceData["usd_market_cap"].(float64)
		volume24hUSD, _ := priceData["usd_24h_vol"].(float64)
		priceChange24h, _ := priceData["usd_24h_change"].(float64)
		lastUpdatedUnix, _ := priceData["last_updated_at"].(float64)

		cryptoPrice := &CryptoPriceData{
			Symbol:         symbol,
			PriceUSD:       priceUSD,
			PriceBTC:       priceBTC,
			MarketCapUSD:   marketCapUSD,
			Volume24hUSD:   volume24hUSD,
			PriceChange24h: priceChange24h,
			LastUpdated:    time.Unix(int64(lastUpdatedUnix), 0),
		}

		results[symbol] = cryptoPrice

		// Cache the result
		if err := cs.cachePrice(cryptoPrice); err != nil {
			fmt.Printf("Failed to cache price for %s: %v\n", symbol, err)
		}
	}

	return results, nil
}

// RefreshAllCryptoPrices refreshes prices for all crypto holdings in the database
func (cs *CryptoService) RefreshAllCryptoPrices() (*CryptoPriceRefreshSummary, error) {
	startTime := time.Now()
	
	// Get all unique crypto symbols from holdings
	query := `SELECT DISTINCT crypto_symbol FROM crypto_holdings`
	rows, err := cs.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get crypto symbols: %w", err)
	}
	defer rows.Close()

	var symbols []string
	for rows.Next() {
		var symbol string
		if err := rows.Scan(&symbol); err != nil {
			continue
		}
		symbols = append(symbols, symbol)
	}

	if len(symbols) == 0 {
		return &CryptoPriceRefreshSummary{
			TotalSymbols:   0,
			UpdatedSymbols: 0,
			FailedSymbols:  0,
			Results:        []CryptoPriceUpdateResult{},
			ProviderName:   "CoinGecko",
			Timestamp:      time.Now(),
			DurationMs:     time.Since(startTime).Milliseconds(),
		}, nil
	}

	// Get old prices for comparison
	oldPrices := make(map[string]*CryptoPriceData)
	for _, symbol := range symbols {
		if oldPrice, err := cs.getCachedPrice(symbol); err == nil && oldPrice != nil {
			oldPrices[symbol] = oldPrice
		}
	}

	// Fetch new prices for all symbols
	newPrices, err := cs.GetMultiplePrices(symbols)
	
	// Build results
	results := make([]CryptoPriceUpdateResult, 0, len(symbols))
	updatedCount := 0
	failedCount := 0

	for _, symbol := range symbols {
		result := CryptoPriceUpdateResult{
			Symbol:    symbol,
			Timestamp: time.Now(),
			Source:    "api",
		}

		// Get old price if available
		if oldPrice, exists := oldPrices[symbol]; exists {
			result.OldPriceUSD = oldPrice.PriceUSD
			result.OldPriceBTC = oldPrice.PriceBTC
			result.CacheAge = fmt.Sprintf("%.0fm", time.Since(oldPrice.LastUpdated).Minutes())
		}

		// Check if we got new price
		if newPrice, exists := newPrices[symbol]; exists {
			result.NewPriceUSD = newPrice.PriceUSD
			result.NewPriceBTC = newPrice.PriceBTC
			result.Updated = true
			updatedCount++

			// Calculate price changes
			if result.OldPriceUSD > 0 {
				result.PriceChangeUSD = result.NewPriceUSD - result.OldPriceUSD
				result.PriceChangePct = (result.PriceChangeUSD / result.OldPriceUSD) * 100
			}
		} else {
			result.Updated = false
			failedCount++
			result.Error = "Failed to fetch price"
			result.ErrorType = "api_error"
		}

		results = append(results, result)
	}

	// Handle global error if GetMultiplePrices failed
	if err != nil {
		for i := range results {
			if !results[i].Updated {
				results[i].Error = err.Error()
				results[i].ErrorType = "api_error"
			}
		}
	}

	return &CryptoPriceRefreshSummary{
		TotalSymbols:   len(symbols),
		UpdatedSymbols: updatedCount,
		FailedSymbols:  failedCount,
		Results:        results,
		ProviderName:   "CoinGecko",
		Timestamp:      time.Now(),
		DurationMs:     time.Since(startTime).Milliseconds(),
	}, nil
}

// getCachedPrice retrieves cached price data from database
func (cs *CryptoService) getCachedPrice(symbol string) (*CryptoPriceData, error) {
	query := `
		SELECT symbol, price_usd, price_btc, market_cap_usd, volume_24h_usd, 
		       price_change_24h, last_updated
		FROM crypto_prices 
		WHERE symbol = $1 
		ORDER BY last_updated DESC 
		LIMIT 1
	`

	var price CryptoPriceData
	err := cs.db.QueryRow(query, strings.ToUpper(symbol)).Scan(
		&price.Symbol, &price.PriceUSD, &price.PriceBTC, &price.MarketCapUSD,
		&price.Volume24hUSD, &price.PriceChange24h, &price.LastUpdated,
	)
	
	if err == sql.ErrNoRows {
		return nil, nil // No cached data
	}
	if err != nil {
		return nil, err
	}

	return &price, nil
}

// cachePrice stores price data in the database
func (cs *CryptoService) cachePrice(price *CryptoPriceData) error {
	query := `
		INSERT INTO crypto_prices (symbol, price_usd, price_btc, market_cap_usd, 
		                          volume_24h_usd, price_change_24h, last_updated, source)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := cs.db.Exec(
		query,
		price.Symbol,
		price.PriceUSD,
		price.PriceBTC,
		price.MarketCapUSD,
		price.Volume24hUSD,
		price.PriceChange24h,
		price.LastUpdated,
		"coingecko",
	)

	return err
}

// symbolToID converts crypto symbol to CoinGecko coin ID
// This is a simplified mapping - in production, you might want to maintain a more comprehensive mapping
func (cs *CryptoService) symbolToID(symbol string) string {
	symbolMap := map[string]string{
		"btc":  "bitcoin",
		"eth":  "ethereum",
		"ada":  "cardano",
		"dot":  "polkadot",
		"sol":  "solana",
		"matic": "polygon",
		"avax": "avalanche-2",
		"link": "chainlink",
		"uni":  "uniswap",
		"ltc":  "litecoin",
		"bch":  "bitcoin-cash",
		"xlm":  "stellar",
		"xrp":  "ripple",
		"doge": "dogecoin",
		"shib": "shiba-inu",
		"bnb":  "binancecoin",
		"usdc": "usd-coin",
		"usdt": "tether",
		"busd": "binance-usd",
		"dai":  "dai",
	}

	symbol = strings.ToLower(symbol)
	if coinID, exists := symbolMap[symbol]; exists {
		return coinID
	}

	// Fallback: assume symbol is the same as coin ID
	return symbol
}