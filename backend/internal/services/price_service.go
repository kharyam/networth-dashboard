package services

import (
	"fmt"
	"math/rand"
	"strings"
	"time"
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
