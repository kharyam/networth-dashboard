package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"networth-dashboard/internal/services"
)

// StockHoldingPlugin handles manual entry for stock holdings from any institution
type StockHoldingPlugin struct {
	db          *sql.DB
	name        string
	accountID   int
	lastUpdated time.Time
}

// NewStockHoldingPlugin creates a new generic stock holding plugin
func NewStockHoldingPlugin(db *sql.DB) *StockHoldingPlugin {
	return &StockHoldingPlugin{
		db:   db,
		name: "stock_holding",
	}
}

// GetName returns the plugin name
func (p *StockHoldingPlugin) GetName() string {
	return p.name
}

// GetFriendlyName returns the user-friendly plugin name
func (p *StockHoldingPlugin) GetFriendlyName() string {
	return "Stock Holding"
}

// GetType returns the plugin type
func (p *StockHoldingPlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *StockHoldingPlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *StockHoldingPlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *StockHoldingPlugin) GetDescription() string {
	return "Manual entry for stock holdings from any institution with automatic price lookup"
}

// Initialize initializes the plugin with configuration
func (p *StockHoldingPlugin) Initialize(config PluginConfig) error {
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Stock Holdings",
		"investment",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize stock holdings account: %w", err)
	}

	p.accountID = accountID
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *StockHoldingPlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *StockHoldingPlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *StockHoldingPlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *StockHoldingPlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          fmt.Sprintf("%d", p.accountID),
			Name:        "Stock Holdings",
			Type:        "investment",
			Institution: "Manual Entry",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *StockHoldingPlugin) GetBalances() ([]Balance, error) {
	// Calculate total value from all stock holdings
	query := `
		SELECT COALESCE(SUM(shares_owned * current_price), 0) as total_value
		FROM stock_holdings 
		WHERE account_id = $1
	`

	var totalValue float64
	err := p.db.QueryRow(query, p.accountID).Scan(&totalValue)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate balance: %w", err)
	}

	return []Balance{
		{
			AccountID:  fmt.Sprintf("%d", p.accountID),
			Amount:     totalValue,
			Currency:   "USD",
			AsOfDate:   time.Now(),
			DataSource: "manual",
		},
	}, nil
}

// GetTransactions returns transactions for this plugin
func (p *StockHoldingPlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// For stock holdings, we don't typically track individual transactions
	// This could be enhanced to track buy/sell transactions if needed
	return []Transaction{}, nil
}

// SupportsManualEntry returns true as this is a manual entry plugin
func (p *StockHoldingPlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *StockHoldingPlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Stock Holding",
		Description: "Add or update stock holdings from any institution",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "institution_name",
				Type:        "text",
				Label:       "Institution Name",
				Description: "The financial institution where you hold these shares (e.g., Computershare, Fidelity, Charles Schwab)",
				Required:    true,
				Placeholder: "Computershare",
			},
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
				Name:        "estimated_quarterly_dividend",
				Type:        "number",
				Label:       "Estimated Quarterly Dividend per Share",
				Description: "Estimated dividend payment per share per quarter (optional, for passive income calculations)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "1.50",
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
			{
				Name:        "is_vested_equity",
				Type:        "select",
				Label:       "Source Type",
				Description: "How these shares were acquired",
				Required:    false,
				Options: []FieldOption{
					{Value: "false", Label: "Regular Purchase"},
					{Value: "true", Label: "Vested Equity"},
				},
				DefaultValue: "false",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *StockHoldingPlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
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

	// Validate institution name
	institutionName, ok := data["institution_name"].(string)
	if !ok || strings.TrimSpace(institutionName) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "institution_name",
			Message: "Institution name is required",
			Code:    "required",
		})
	} else {
		data["institution_name"] = strings.TrimSpace(institutionName)
	}

	// Validate shares owned
	if sharesData, exists := data["shares_owned"]; exists && sharesData != nil {
		var shares float64
		var err error
		
		switch v := sharesData.(type) {
		case string:
			if v == "" {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "shares_owned",
					Message: "Shares owned is required",
					Code:    "required",
				})
			} else {
				shares, err = strconv.ParseFloat(v, 64)
				if err != nil {
					result.Valid = false
					result.Errors = append(result.Errors, ValidationError{
						Field:   "shares_owned",
						Message: "Shares owned must be a valid number",
						Code:    "invalid_number",
					})
				}
			}
		case float64:
			shares = v
		case float32:
			shares = float64(v)
		case int:
			shares = float64(v)
		case int64:
			shares = float64(v)
		default:
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "shares_owned",
				Message: "Shares owned must be a number",
				Code:    "invalid_type",
			})
		}

		if err == nil && shares <= 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "shares_owned",
				Message: "Shares owned must be greater than 0",
				Code:    "invalid_range",
			})
		} else if err == nil {
			data["shares_owned"] = shares
		}
	} else {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "shares_owned",
			Message: "Shares owned is required",
			Code:    "required",
		})
	}

	// Validate cost basis if provided
	if costBasisData, exists := data["cost_basis"]; exists && costBasisData != nil {
		// Skip empty strings for optional fields
		if str, isStr := costBasisData.(string); isStr && str == "" {
			// Empty string means no cost basis, skip validation
		} else {
			var costBasis float64
			var err error
			
			switch v := costBasisData.(type) {
			case string:
				if v != "" {
					costBasis, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, skip
					goto skipCostBasis
				}
			case float64:
				costBasis = v
			case float32:
				costBasis = float64(v)
			case int:
				costBasis = float64(v)
			case int64:
				costBasis = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "cost_basis",
					Message: "Cost basis must be a valid number",
					Code:    "invalid_number",
				})
			} else if costBasis < 0 {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "cost_basis",
					Message: "Cost basis cannot be negative",
					Code:    "invalid_range",
				})
			} else {
				data["cost_basis"] = costBasis
			}
		}
		skipCostBasis:
	}

	// Validate estimated_quarterly_dividend if provided
	if dividendData, exists := data["estimated_quarterly_dividend"]; exists && dividendData != nil {
		// Skip empty strings for optional fields
		if str, isStr := dividendData.(string); isStr && str == "" {
			// Empty string means no dividend, skip validation
		} else {
			var dividend float64
			var err error
			
			switch v := dividendData.(type) {
			case string:
				if v != "" {
					dividend, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, skip
					goto skipDividend
				}
			case float64:
				dividend = v
			case float32:
				dividend = float64(v)
			case int:
				dividend = float64(v)
			case int64:
				dividend = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "estimated_quarterly_dividend",
					Message: "Estimated quarterly dividend must be a valid number",
					Code:    "invalid_number",
				})
			} else if dividend < 0 {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "estimated_quarterly_dividend",
					Message: "Estimated quarterly dividend cannot be negative",
					Code:    "invalid_range",
				})
			} else {
				data["estimated_quarterly_dividend"] = dividend
			}
		}
		skipDividend:
	}

	// Validate optional is_vested_equity
	var isVestedEquity bool = false
	if vestedData, exists := data["is_vested_equity"]; exists && vestedData != nil {
		if vestedStr, ok := vestedData.(string); ok {
			if vestedStr == "true" {
				isVestedEquity = true
			} else if vestedStr == "false" {
				isVestedEquity = false
			} else {
				result.Valid = false
				result.Errors = append(result.Errors, ValidationError{
					Field:   "is_vested_equity",
					Message: "Vested equity flag must be 'true' or 'false'",
					Code:    "invalid",
				})
			}
		} else if vestedBool, ok := vestedData.(bool); ok {
			isVestedEquity = vestedBool
		} else {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "is_vested_equity",
				Message: "Invalid vested equity flag",
				Code:    "invalid",
			})
		}
	}
	data["is_vested_equity"] = isVestedEquity

	result.Data = data
	return result
}

// ProcessManualEntry processes the manual entry data
func (p *StockHoldingPlugin) ProcessManualEntry(data map[string]interface{}) error {
	symbol := data["symbol"].(string)
	institutionName := data["institution_name"].(string)
	shares := data["shares_owned"].(float64)

	var costBasis float64
	if cb, exists := data["cost_basis"]; exists && cb != nil {
		costBasis = cb.(float64)
	}

	var companyName string
	if cn, exists := data["company_name"]; exists && cn != nil {
		companyName = cn.(string)
	}

	var estimatedQuarterlyDividend float64
	if div, exists := data["estimated_quarterly_dividend"]; exists && div != nil {
		estimatedQuarterlyDividend = div.(float64)
	}

	var purchaseDate *time.Time
	if pd, exists := data["purchase_date"]; exists && pd != nil {
		if pdStr, ok := pd.(string); ok && pdStr != "" {
			if parsedDate, err := time.Parse("2006-01-02", pdStr); err == nil {
				purchaseDate = &parsedDate
			}
		}
	}

	var dripEnabled string = "unknown"
	if drip, exists := data["drip_enabled"]; exists && drip != nil {
		if dripStr, ok := drip.(string); ok && dripStr != "" {
			dripEnabled = dripStr
		}
	}

	// Get current market price from price service
	priceService := services.NewPriceService()
	currentPrice, err := priceService.GetCurrentPrice(symbol)
	if err != nil {
		// Log error but continue with 0 price - can be updated later
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", symbol, err)
		currentPrice = 0
	}

	// Create unique account for this stock holding
	uniqueIdentifier := fmt.Sprintf("%s at %s", symbol, institutionName)
	uniqueAccountID, err := GetOrCreateUniquePluginAccount(
		p.db,
		"Stock Holdings",
		uniqueIdentifier,
		"stock",
		institutionName,
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to create unique account for stock holding: %w", err)
	}

	// Extract vested equity flag from validated data
	isVestedEquity := data["is_vested_equity"].(bool)

	// Insert stock holding
	query := `
		INSERT INTO stock_holdings (
			account_id, symbol, company_name, shares_owned, cost_basis, 
			current_price, institution_name, data_source, estimated_quarterly_dividend,
			purchase_date, drip_enabled, last_manual_update, is_vested_equity
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, execErr := p.db.Exec(query,
		uniqueAccountID, symbol, companyName, shares, costBasis,
		currentPrice, institutionName, "stock_holding", estimatedQuarterlyDividend,
		purchaseDate, dripEnabled, time.Now(), isVestedEquity,
	)

	if execErr != nil {
		return fmt.Errorf("failed to save stock holding: %w", execErr)
	}

	p.lastUpdated = time.Now()
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *StockHoldingPlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	symbol := data["symbol"].(string)
	institutionName := data["institution_name"].(string)
	shares := data["shares_owned"].(float64)

	var costBasis float64
	if cb, exists := data["cost_basis"]; exists && cb != nil {
		costBasis = cb.(float64)
	}

	var companyName string
	if cn, exists := data["company_name"]; exists && cn != nil {
		companyName = cn.(string)
	}

	var estimatedQuarterlyDividend float64
	if div, exists := data["estimated_quarterly_dividend"]; exists && div != nil {
		estimatedQuarterlyDividend = div.(float64)
	}

	var purchaseDate *time.Time
	if pd, exists := data["purchase_date"]; exists && pd != nil {
		if pdStr, ok := pd.(string); ok && pdStr != "" {
			if parsedDate, err := time.Parse("2006-01-02", pdStr); err == nil {
				purchaseDate = &parsedDate
			}
		}
	}

	var dripEnabled string = "unknown"
	if drip, exists := data["drip_enabled"]; exists && drip != nil {
		if dripStr, ok := drip.(string); ok && dripStr != "" {
			dripEnabled = dripStr
		}
	}

	// Extract vested equity flag from validated data
	isVestedEquity := validation.Data["is_vested_equity"].(bool)

	// Get current market price from price service
	priceService := services.NewPriceService()
	currentPrice, err := priceService.GetCurrentPrice(symbol)
	if err != nil {
		// Log error but continue with existing price
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", symbol, err)
		// Get existing price from database
		var existingPrice float64
		priceQuery := "SELECT COALESCE(current_price, 0) FROM stock_holdings WHERE id = $1"
		p.db.QueryRow(priceQuery, id).Scan(&existingPrice)
		currentPrice = existingPrice
	}

	// Update stock holding
	query := `
		UPDATE stock_holdings 
		SET symbol = $1, company_name = $2, shares_owned = $3, cost_basis = $4, 
		    current_price = $5, institution_name = $6, last_updated = $7, estimated_quarterly_dividend = $8,
		    purchase_date = $9, drip_enabled = $10, last_manual_update = $11, is_vested_equity = $12
		WHERE id = $13 AND data_source = 'stock_holding'
	`

	result, err := p.db.Exec(query,
		symbol, companyName, shares, costBasis,
		currentPrice, institutionName, time.Now(), estimatedQuarterlyDividend,
		purchaseDate, dripEnabled, time.Now(), isVestedEquity, id,
	)

	if err != nil {
		return fmt.Errorf("failed to update stock holding: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check update result: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("stock holding not found or not owned by this plugin")
	}

	p.lastUpdated = time.Now()
	return nil
}

// RefreshData refreshes data for this plugin
func (p *StockHoldingPlugin) RefreshData() error {
	// For manual entry, we could refresh market prices
	// This is a placeholder for market data integration
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *StockHoldingPlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}