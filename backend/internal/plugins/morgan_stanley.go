package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"networth-dashboard/internal/services"
)

// MorganStanleyPlugin handles manual entry for Morgan Stanley equity compensation
type MorganStanleyPlugin struct {
	db          *sql.DB
	name        string
	accountID   int
	lastUpdated time.Time
}

// NewMorganStanleyPlugin creates a new Morgan Stanley plugin
func NewMorganStanleyPlugin(db *sql.DB) *MorganStanleyPlugin {
	return &MorganStanleyPlugin{
		db:   db,
		name: "morgan_stanley",
	}
}

// GetName returns the plugin name
func (p *MorganStanleyPlugin) GetName() string {
	return p.name
}

// GetType returns the plugin type
func (p *MorganStanleyPlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *MorganStanleyPlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *MorganStanleyPlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *MorganStanleyPlugin) GetDescription() string {
	return "Manual entry for Morgan Stanley equity compensation including RSUs, stock options, and ESPP"
}

// Initialize initializes the plugin with configuration
func (p *MorganStanleyPlugin) Initialize(config PluginConfig) error {
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Morgan Stanley Equity Compensation",
		"equity",
		"Morgan Stanley",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize Morgan Stanley account: %w", err)
	}

	p.accountID = accountID
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *MorganStanleyPlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *MorganStanleyPlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *MorganStanleyPlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *MorganStanleyPlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          fmt.Sprintf("%d", p.accountID),
			Name:        "Morgan Stanley Equity Compensation",
			Type:        "equity",
			Institution: "Morgan Stanley",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *MorganStanleyPlugin) GetBalances() ([]Balance, error) {
	// Calculate total vested equity value
	query := `
		SELECT COALESCE(SUM(vested_shares * current_price), 0) as vested_value
		FROM equity_grants 
		WHERE account_id = $1
	`

	var vestedValue float64
	err := p.db.QueryRow(query, p.accountID).Scan(&vestedValue)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate vested equity value: %w", err)
	}

	return []Balance{
		{
			AccountID:  fmt.Sprintf("%d", p.accountID),
			Amount:     vestedValue,
			Currency:   "USD",
			AsOfDate:   time.Now(),
			DataSource: "manual",
		},
	}, nil
}

// GetTransactions returns transactions for this plugin
func (p *MorganStanleyPlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// Could track vesting events as transactions
	return []Transaction{}, nil
}

// SupportsManualEntry returns true as this is a manual entry plugin
func (p *MorganStanleyPlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *MorganStanleyPlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Morgan Stanley Equity Grant",
		Description: "Add or update equity compensation grants (RSUs, Stock Options, ESPP)",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "grant_type",
				Type:        "select",
				Label:       "Grant Type",
				Description: "Type of equity grant",
				Required:    true,
				Options: []FieldOption{
					{Value: "rsu", Label: "Restricted Stock Units (RSU)"},
					{Value: "stock_option", Label: "Stock Options"},
					{Value: "espp", Label: "Employee Stock Purchase Plan (ESPP)"},
				},
			},
			{
				Name:        "company_symbol",
				Type:        "text",
				Label:       "Company Symbol",
				Description: "Stock ticker symbol for the company",
				Required:    true,
				Validation: FieldValidation{
					Pattern:   "^[A-Z]{1,5}$",
					MaxLength: func(i int) *int { return &i }(5),
				},
				Placeholder: "MSFT",
			},
			{
				Name:        "total_shares",
				Type:        "number",
				Label:       "Total Shares Granted",
				Description: "Total number of shares in this grant",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(1),
				},
				Placeholder: "1000",
			},
			{
				Name:        "vested_shares",
				Type:        "number",
				Label:       "Vested Shares",
				Description: "Number of shares currently vested",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "250",
			},
			{
				Name:        "strike_price",
				Type:        "number",
				Label:       "Strike Price",
				Description: "Strike price for options (leave empty for RSUs)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "100.00",
			},
			{
				Name:        "grant_date",
				Type:        "date",
				Label:       "Grant Date",
				Description: "Date when the grant was issued",
				Required:    true,
			},
			{
				Name:        "vest_start_date",
				Type:        "date",
				Label:       "Vesting Start Date",
				Description: "Date when vesting begins",
				Required:    true,
			},
			{
				Name:        "vesting_schedule",
				Type:        "select",
				Label:       "Vesting Schedule",
				Description: "How the shares vest over time",
				Required:    true,
				Options: []FieldOption{
					{Value: "quarterly", Label: "Quarterly (25% per year)"},
					{Value: "monthly", Label: "Monthly"},
					{Value: "cliff_1_year", Label: "1 Year Cliff + Monthly"},
					{Value: "custom", Label: "Custom Schedule"},
				},
				DefaultValue: "quarterly",
			},
			{
				Name:        "vesting_period_years",
				Type:        "number",
				Label:       "Vesting Period (Years)",
				Description: "Total vesting period in years",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0.25),
					Max: func(f float64) *float64 { return &f }(10),
				},
				DefaultValue: 4,
				Placeholder:  "4",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *MorganStanleyPlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
	result := ValidationResult{Valid: true}

	// Validate grant type
	grantType, ok := data["grant_type"].(string)
	if !ok || grantType == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "grant_type",
			Message: "Grant type is required",
			Code:    "required",
		})
	}

	// Validate company symbol
	symbol, ok := data["company_symbol"].(string)
	if !ok || symbol == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "company_symbol",
			Message: "Company symbol is required",
			Code:    "required",
		})
	} else {
		symbol = strings.ToUpper(strings.TrimSpace(symbol))
		data["company_symbol"] = symbol
	}

	// Validate total shares
	totalShares, err := p.validateNumberField(data, "total_shares", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	} else if totalShares <= 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "total_shares",
			Message: "Total shares must be greater than 0",
			Code:    "invalid_range",
		})
	}

	// Validate vested shares
	vestedShares, err := p.validateNumberField(data, "vested_shares", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	} else if vestedShares < 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "vested_shares",
			Message: "Vested shares cannot be negative",
			Code:    "invalid_range",
		})
	} else if vestedShares > totalShares {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "vested_shares",
			Message: "Vested shares cannot exceed total shares",
			Code:    "invalid_range",
		})
	}

	// Calculate and validate unvested shares
	unvestedShares := totalShares - vestedShares
	if unvestedShares < 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "vested_shares",
			Message: "Vested shares cannot exceed total shares",
			Code:    "invalid_calculation",
		})
	}
	// Store calculated unvested shares for consistency
	data["unvested_shares"] = unvestedShares

	// Validate strike price for options
	if grantType == "stock_option" {
		strikePrice, err := p.validateNumberField(data, "strike_price", true)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		} else if strikePrice <= 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "strike_price",
				Message: "Strike price must be greater than 0 for options",
				Code:    "invalid_range",
			})
		}
	}

	// Validate dates
	grantDate, err := p.validateDateField(data, "grant_date", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	}

	vestStartDate, err := p.validateDateField(data, "vest_start_date", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	}

	// Validate date logic: grant_date should be <= vest_start_date
	if !grantDate.IsZero() && !vestStartDate.IsZero() && grantDate.After(vestStartDate) {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "vest_start_date",
			Message: "Vesting start date cannot be before grant date",
			Code:    "invalid_date_order",
		})
	}

	// Validate dates are not in far future (more than 10 years)
	maxFutureDate := time.Now().AddDate(10, 0, 0)
	if !grantDate.IsZero() && grantDate.After(maxFutureDate) {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "grant_date",
			Message: "Grant date cannot be more than 10 years in the future",
			Code:    "invalid_date_range",
		})
	}
	if !vestStartDate.IsZero() && vestStartDate.After(maxFutureDate) {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "vest_start_date",
			Message: "Vesting start date cannot be more than 10 years in the future",
			Code:    "invalid_date_range",
		})
	}

	result.Data = data
	return result
}

// ProcessManualEntry processes the manual entry data
func (p *MorganStanleyPlugin) ProcessManualEntry(data map[string]interface{}) error {
	// Validate and extract all fields using helper methods
	grantType, exists := data["grant_type"].(string)
	if !exists || grantType == "" {
		return fmt.Errorf("grant_type is required and must be a string")
	}

	symbol, exists := data["company_symbol"].(string)
	if !exists || symbol == "" {
		return fmt.Errorf("company_symbol is required and must be a string")
	}

	totalShares, err := p.validateNumberField(data, "total_shares", true)
	if err != nil {
		return fmt.Errorf("total_shares validation failed: %s", err.Message)
	}

	vestedShares, err := p.validateNumberField(data, "vested_shares", true)
	if err != nil {
		return fmt.Errorf("vested_shares validation failed: %s", err.Message)
	}

	strikePrice, err := p.validateNumberField(data, "strike_price", false)
	if err != nil {
		return fmt.Errorf("strike_price validation failed: %s", err.Message)
	}

	grantDate, err := p.validateDateField(data, "grant_date", true)
	if err != nil {
		return fmt.Errorf("grant_date validation failed: %s", err.Message)
	}

	vestStartDate, err := p.validateDateField(data, "vest_start_date", true)
	if err != nil {
		return fmt.Errorf("vest_start_date validation failed: %s", err.Message)
	}

	// Get current market price from price service
	priceService := services.NewPriceService()
	currentPrice, priceErr := priceService.GetCurrentPrice(symbol)
	if priceErr != nil {
		// Log error but continue with 0 price - can be updated later
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", symbol, priceErr)
		currentPrice = 0
	}

	// Insert equity grant with current price
	query := `
		INSERT INTO equity_grants (
			account_id, grant_type, company_symbol, total_shares, vested_shares, 
			unvested_shares, strike_price, current_price, grant_date, vest_start_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	unvestedShares := totalShares - vestedShares
	_, execErr := p.db.Exec(query,
		p.accountID, grantType, symbol, totalShares, vestedShares,
		unvestedShares, strikePrice, currentPrice, grantDate, vestStartDate,
	)

	if execErr != nil {
		return fmt.Errorf("failed to save equity grant: %w", execErr)
	}

	p.lastUpdated = time.Now()
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *MorganStanleyPlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	grantType := data["grant_type"].(string)
	companySymbol := data["company_symbol"].(string)
	totalShares := data["total_shares"].(float64)
	vestedShares := data["vested_shares"].(float64)
	unvestedShares := data["unvested_shares"].(float64)

	var strikePrice float64
	if sp, exists := data["strike_price"]; exists && sp != nil {
		strikePrice = sp.(float64)
	}

	grantDate := data["grant_date"].(time.Time)
	vestStartDate := data["vest_start_date"].(time.Time)

	// Get current market price from price service
	priceService := services.NewPriceService()
	currentPrice, err := priceService.GetCurrentPrice(companySymbol)
	if err != nil {
		// Log error but continue with existing price
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", companySymbol, err)
		// Get existing price from database
		var existingPrice float64
		priceQuery := "SELECT COALESCE(current_price, 0) FROM equity_grants WHERE id = $1"
		p.db.QueryRow(priceQuery, id).Scan(&existingPrice)
		currentPrice = existingPrice
	}

	// Update equity grant
	query := `
		UPDATE equity_grants 
		SET grant_type = $1, company_symbol = $2, total_shares = $3, vested_shares = $4, 
		    unvested_shares = $5, strike_price = $6, current_price = $7, grant_date = $8, 
		    vest_start_date = $9, last_updated = $10
		WHERE id = $11
	`

	result, err := p.db.Exec(query,
		grantType, companySymbol, totalShares, vestedShares,
		unvestedShares, strikePrice, currentPrice, grantDate, vestStartDate,
		time.Now(), id,
	)

	if err != nil {
		return fmt.Errorf("failed to update equity grant: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check update result: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("equity grant not found")
	}

	p.lastUpdated = time.Now()
	return nil
}

// RefreshData refreshes data for this plugin
func (p *MorganStanleyPlugin) RefreshData() error {
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *MorganStanleyPlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}

// Helper methods for validation
func (p *MorganStanleyPlugin) validateNumberField(data map[string]interface{}, field string, required bool) (float64, *ValidationError) {
	value, exists := data[field]
	if !exists {
		if required {
			return 0, &ValidationError{
				Field:   field,
				Message: fmt.Sprintf("%s is required", field),
				Code:    "required",
			}
		}
		return 0, nil
	}

	var num float64
	switch v := value.(type) {
	case float64:
		num = v
	case string:
		// Handle empty strings for optional fields
		if v == "" {
			if required {
				return 0, &ValidationError{
					Field:   field,
					Message: fmt.Sprintf("%s is required", field),
					Code:    "required",
				}
			} else {
				// Optional field with empty string - treat as 0
				num = 0
			}
		} else {
			// Parse non-empty strings
			var err error
			num, err = strconv.ParseFloat(v, 64)
			if err != nil {
				return 0, &ValidationError{
					Field:   field,
					Message: fmt.Sprintf("%s must be a valid number", field),
					Code:    "invalid_number",
				}
			}
		}
	default:
		return 0, &ValidationError{
			Field:   field,
			Message: fmt.Sprintf("%s must be a number", field),
			Code:    "invalid_type",
		}
	}

	data[field] = num
	return num, nil
}

func (p *MorganStanleyPlugin) validateDateField(data map[string]interface{}, field string, required bool) (time.Time, *ValidationError) {
	value, exists := data[field]
	if !exists {
		if required {
			return time.Time{}, &ValidationError{
				Field:   field,
				Message: fmt.Sprintf("%s is required", field),
				Code:    "required",
			}
		}
		return time.Time{}, nil
	}

	dateStr, ok := value.(string)
	if !ok {
		return time.Time{}, &ValidationError{
			Field:   field,
			Message: fmt.Sprintf("%s must be a date string", field),
			Code:    "invalid_type",
		}
	}

	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, &ValidationError{
			Field:   field,
			Message: fmt.Sprintf("%s must be in YYYY-MM-DD format", field),
			Code:    "invalid_format",
		}
	}

	return date, nil
}
