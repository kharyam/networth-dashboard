package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ComputersharePlugin handles manual entry for Computershare stock holdings
type ComputersharePlugin struct {
	db          *sql.DB
	name        string
	lastUpdated time.Time
}

// NewComputersharePlugin creates a new Computershare plugin
func NewComputersharePlugin(db *sql.DB) *ComputersharePlugin {
	return &ComputersharePlugin{
		db:   db,
		name: "computershare",
	}
}

// GetName returns the plugin name
func (p *ComputersharePlugin) GetName() string {
	return p.name
}

// GetType returns the plugin type
func (p *ComputersharePlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *ComputersharePlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *ComputersharePlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *ComputersharePlugin) GetDescription() string {
	return "Manual entry for Computershare stock holdings with automatic price lookup"
}

// Initialize initializes the plugin with configuration
func (p *ComputersharePlugin) Initialize(config PluginConfig) error {
	// No special initialization needed for manual entry
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *ComputersharePlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *ComputersharePlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *ComputersharePlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *ComputersharePlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          "computershare-main",
			Name:        "Computershare Holdings",
			Type:        "investment",
			Institution: "Computershare",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *ComputersharePlugin) GetBalances() ([]Balance, error) {
	// Calculate total value from all stock holdings
	query := `
		SELECT COALESCE(SUM(shares_owned * current_price), 0) as total_value
		FROM stock_holdings 
		WHERE data_source = 'computershare'
	`
	
	var totalValue float64
	err := p.db.QueryRow(query).Scan(&totalValue)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate balance: %w", err)
	}

	return []Balance{
		{
			AccountID:  "computershare-main",
			Amount:     totalValue,
			Currency:   "USD",
			AsOfDate:   time.Now(),
			DataSource: "manual",
		},
	}, nil
}

// GetTransactions returns transactions for this plugin
func (p *ComputersharePlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// For stock holdings, we don't typically track individual transactions
	// This could be enhanced to track buy/sell transactions if needed
	return []Transaction{}, nil
}

// SupportsManualEntry returns true as this is a manual entry plugin
func (p *ComputersharePlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *ComputersharePlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Computershare Stock Holding",
		Description: "Add or update stock holdings in your Computershare account",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "symbol",
				Type:        "text",
				Label:       "Stock Symbol",
				Description: "Stock ticker symbol (e.g., AAPL, MSFT)",
				Required:    true,
				Validation: FieldValidation{
					Pattern:   "^[A-Z]{1,5}$",
					MaxLength: func(i int) *int { return &i }(5),
				},
				Placeholder: "AAPL",
			},
			{
				Name:        "company_name",
				Type:        "text",
				Label:       "Company Name",
				Description: "Full company name (will be auto-filled if symbol is recognized)",
				Required:    false,
				Placeholder: "Apple Inc.",
			},
			{
				Name:        "shares_owned",
				Type:        "number",
				Label:       "Shares Owned",
				Description: "Number of shares you own",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0.001),
				},
				Placeholder: "100",
			},
			{
				Name:        "cost_basis",
				Type:        "number",
				Label:       "Cost Basis per Share",
				Description: "Your average cost per share (optional, for tracking gains/losses)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "150.00",
			},
			{
				Name:        "purchase_date",
				Type:        "date",
				Label:       "Purchase Date",
				Description: "Date when shares were acquired (optional)",
				Required:    false,
			},
			{
				Name:        "drip_enabled",
				Type:        "select",
				Label:       "DRIP Enabled",
				Description: "Is Dividend Reinvestment Plan enabled?",
				Required:    false,
				Options: []FieldOption{
					{Value: "true", Label: "Yes"},
					{Value: "false", Label: "No"},
					{Value: "unknown", Label: "Unknown"},
				},
				DefaultValue: "unknown",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *ComputersharePlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
	result := ValidationResult{Valid: true}

	// Validate required fields
	symbol, ok := data["symbol"].(string)
	if !ok || symbol == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "symbol",
			Message: "Stock symbol is required",
			Code:    "required",
		})
	} else {
		// Validate symbol format
		symbol = strings.ToUpper(strings.TrimSpace(symbol))
		if len(symbol) < 1 || len(symbol) > 5 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "symbol",
				Message: "Stock symbol must be 1-5 characters",
				Code:    "invalid_format",
			})
		}
		data["symbol"] = symbol
	}

	// Validate shares owned
	if sharesRaw, exists := data["shares_owned"]; exists {
		var shares float64
		switch v := sharesRaw.(type) {
		case float64:
			shares = v
		case string:
			var err error
			shares, err = strconv.ParseFloat(v, 64)
			if err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "shares_owned",
					Message: "Shares owned must be a valid number",
					Code:    "invalid_number",
				})
			}
		default:
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "shares_owned",
				Message: "Shares owned must be a number",
				Code:    "invalid_type",
			})
		}

		if shares <= 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "shares_owned",
				Message: "Shares owned must be greater than 0",
				Code:    "invalid_range",
			})
		}
		data["shares_owned"] = shares
	} else {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "shares_owned",
			Message: "Shares owned is required",
			Code:    "required",
		})
	}

	// Validate cost basis if provided
	if costBasisRaw, exists := data["cost_basis"]; exists && costBasisRaw != nil {
		var costBasis float64
		switch v := costBasisRaw.(type) {
		case float64:
			costBasis = v
		case string:
			if v != "" {
				var err error
				costBasis, err = strconv.ParseFloat(v, 64)
				if err != nil {
					result.Valid = false
					result.Errors = append(result.Errors, ValidationError{
						Field:   "cost_basis",
						Message: "Cost basis must be a valid number",
						Code:    "invalid_number",
					})
				}
			}
		}

		if costBasis < 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "cost_basis",
				Message: "Cost basis cannot be negative",
				Code:    "invalid_range",
			})
		}
		data["cost_basis"] = costBasis
	}

	result.Data = data
	return result
}

// ProcessManualEntry processes the manual entry data
func (p *ComputersharePlugin) ProcessManualEntry(data map[string]interface{}) error {
	symbol := data["symbol"].(string)
	shares := data["shares_owned"].(float64)
	
	var costBasis float64
	if cb, exists := data["cost_basis"]; exists && cb != nil {
		costBasis = cb.(float64)
	}

	var companyName string
	if cn, exists := data["company_name"]; exists && cn != nil {
		companyName = cn.(string)
	}

	// Get current market price (placeholder - would integrate with market data API)
	currentPrice := 150.0 // This would be fetched from a market data API

	// Insert or update stock holding
	query := `
		INSERT INTO stock_holdings (
			account_id, symbol, company_name, shares_owned, cost_basis, 
			current_price, market_value, data_source, last_updated
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (symbol, data_source) DO UPDATE SET
			shares_owned = EXCLUDED.shares_owned,
			cost_basis = EXCLUDED.cost_basis,
			current_price = EXCLUDED.current_price,
			market_value = EXCLUDED.market_value,
			last_updated = EXCLUDED.last_updated
	`

	marketValue := shares * currentPrice
	now := time.Now()

	_, err := p.db.Exec(query,
		"computershare-main", symbol, companyName, shares, costBasis,
		currentPrice, marketValue, "computershare", now,
	)

	if err != nil {
		return fmt.Errorf("failed to save stock holding: %w", err)
	}

	p.lastUpdated = now
	return nil
}

// RefreshData refreshes data for this plugin
func (p *ComputersharePlugin) RefreshData() error {
	// For manual entry, we could refresh market prices
	// This is a placeholder for market data integration
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *ComputersharePlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}