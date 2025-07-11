package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// CashHoldingsPlugin handles manual entry for cash holdings (checking, savings, etc.)
type CashHoldingsPlugin struct {
	db          *sql.DB
	name        string
	accountID   int
	lastUpdated time.Time
}

// NewCashHoldingsPlugin creates a new Cash Holdings plugin
func NewCashHoldingsPlugin(db *sql.DB) *CashHoldingsPlugin {
	return &CashHoldingsPlugin{
		db:   db,
		name: "cash_holdings",
	}
}

// GetName returns the plugin name
func (p *CashHoldingsPlugin) GetName() string {
	return p.name
}

// GetFriendlyName returns the user-friendly plugin name
func (p *CashHoldingsPlugin) GetFriendlyName() string {
	return "Cash Holdings"
}

// GetType returns the plugin type
func (p *CashHoldingsPlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *CashHoldingsPlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *CashHoldingsPlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *CashHoldingsPlugin) GetDescription() string {
	return "Manual entry for cash holdings including checking, savings, money market, and CD accounts"
}

// Initialize initializes the plugin with configuration
func (p *CashHoldingsPlugin) Initialize(config PluginConfig) error {
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Cash Holdings Portfolio",
		"cash_holdings",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize Cash Holdings account: %w", err)
	}

	p.accountID = accountID
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *CashHoldingsPlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *CashHoldingsPlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *CashHoldingsPlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *CashHoldingsPlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          fmt.Sprintf("%d", p.accountID),
			Name:        "Cash Holdings Portfolio",
			Type:        "cash_holdings",
			Institution: "Manual Entry",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *CashHoldingsPlugin) GetBalances() ([]Balance, error) {
	var balances []Balance

	query := `
		SELECT current_balance, currency, updated_at
		FROM cash_holdings
		WHERE account_id = $1
	`

	rows, err := p.db.Query(query, p.accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to query cash holdings balances: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var balance Balance
		err := rows.Scan(&balance.Amount, &balance.Currency, &balance.AsOfDate)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cash holding balance: %w", err)
		}

		balance.AccountID = fmt.Sprintf("%d", p.accountID)
		balance.DataSource = "manual"
		balances = append(balances, balance)
	}

	return balances, nil
}

// GetTransactions returns transactions for this plugin
func (p *CashHoldingsPlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// Cash holdings typically don't have detailed transaction data in manual entry
	// This could be extended in the future to track deposits/withdrawals
	return []Transaction{}, nil
}

// RefreshData refreshes plugin data (not applicable for manual entry)
func (p *CashHoldingsPlugin) RefreshData() error {
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *CashHoldingsPlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}

// SupportsManualEntry returns true as this plugin supports manual data entry
func (p *CashHoldingsPlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *CashHoldingsPlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Cash Holdings",
		Description: "Add or update cash holdings in your portfolio",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "institution_name",
				Type:        "text",
				Label:       "Institution Name",
				Description: "Name of the bank or financial institution",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(100),
				},
				Placeholder: "Chase Bank",
			},
			{
				Name:        "account_name",
				Type:        "text",
				Label:       "Account Name",
				Description: "Name or nickname for this account",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(100),
				},
				Placeholder: "Primary Checking",
			},
			{
				Name:        "account_type",
				Type:        "select",
				Label:       "Account Type",
				Description: "Type of cash account",
				Required:    true,
				Options: []FieldOption{
					{Value: "checking", Label: "Checking"},
					{Value: "savings", Label: "Savings"},
					{Value: "money_market", Label: "Money Market"},
					{Value: "cd", Label: "Certificate of Deposit (CD)"},
					{Value: "high_yield_savings", Label: "High Yield Savings"},
					{Value: "brokerage", Label: "Brokerage Account"},
					{Value: "other", Label: "Other"},
				},
			},
			{
				Name:        "current_balance",
				Type:        "number",
				Label:       "Current Balance / Total Value",
				Description: "Current balance (for cash accounts) or total value (for brokerage accounts)",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "10000",
			},
			{
				Name:        "interest_rate",
				Type:        "number",
				Label:       "Interest Rate / Average Return (%)",
				Description: "Annual interest rate (for cash accounts) or average return (for brokerage accounts)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(-100),
					Max: func(f float64) *float64 { return &f }(100),
				},
				Placeholder: "2.5",
			},
			{
				Name:        "monthly_contribution",
				Type:        "number",
				Label:       "Monthly Contribution",
				Description: "Regular monthly contribution amount (optional)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "500",
			},
			{
				Name:        "account_number_last4",
				Type:        "text",
				Label:       "Last 4 Digits",
				Description: "Last 4 digits of account number (for identification)",
				Required:    false,
				Validation: FieldValidation{
					Pattern:   "^[0-9]{4}$",
					MinLength: func(i int) *int { return &i }(4),
					MaxLength: func(i int) *int { return &i }(4),
				},
				Placeholder: "1234",
			},
			{
				Name:        "currency",
				Type:        "select",
				Label:       "Currency",
				Description: "Currency of the account",
				Required:    true,
				DefaultValue: "USD",
				Options: []FieldOption{
					{Value: "USD", Label: "US Dollar (USD)"},
					{Value: "EUR", Label: "Euro (EUR)"},
					{Value: "GBP", Label: "British Pound (GBP)"},
					{Value: "CAD", Label: "Canadian Dollar (CAD)"},
				},
			},
			{
				Name:        "notes",
				Type:        "textarea",
				Label:       "Notes",
				Description: "Additional notes about this account",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(500),
				},
				Placeholder: "Any additional notes about this account...",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *CashHoldingsPlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
	var errors []ValidationError
	validatedData := make(map[string]interface{})

	// Validate institution_name
	if institutionName, ok := data["institution_name"].(string); ok {
		institutionName = strings.TrimSpace(institutionName)
		if institutionName == "" {
			errors = append(errors, ValidationError{
				Field:   "institution_name",
				Message: "Institution name is required",
				Code:    "required",
			})
		} else if len(institutionName) > 100 {
			errors = append(errors, ValidationError{
				Field:   "institution_name",
				Message: "Institution name must be 100 characters or less",
				Code:    "max_length",
			})
		} else {
			validatedData["institution_name"] = institutionName
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "institution_name",
			Message: "Institution name is required",
			Code:    "required",
		})
	}

	// Validate account_name
	if accountName, ok := data["account_name"].(string); ok {
		accountName = strings.TrimSpace(accountName)
		if accountName == "" {
			errors = append(errors, ValidationError{
				Field:   "account_name",
				Message: "Account name is required",
				Code:    "required",
			})
		} else if len(accountName) > 100 {
			errors = append(errors, ValidationError{
				Field:   "account_name",
				Message: "Account name must be 100 characters or less",
				Code:    "max_length",
			})
		} else {
			validatedData["account_name"] = accountName
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "account_name",
			Message: "Account name is required",
			Code:    "required",
		})
	}

	// Validate account_type
	validAccountTypes := []string{"checking", "savings", "money_market", "cd", "high_yield_savings", "brokerage", "other"}
	if accountType, ok := data["account_type"].(string); ok {
		found := false
		for _, validType := range validAccountTypes {
			if accountType == validType {
				found = true
				break
			}
		}
		if !found {
			errors = append(errors, ValidationError{
				Field:   "account_type",
				Message: "Invalid account type",
				Code:    "invalid",
			})
		} else {
			validatedData["account_type"] = accountType
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "account_type",
			Message: "Account type is required",
			Code:    "required",
		})
	}

	// Validate current_balance
	if balanceData, ok := data["current_balance"]; ok {
		var balance float64
		var err error
		
		switch v := balanceData.(type) {
		case string:
			balance, err = strconv.ParseFloat(v, 64)
		case float64:
			balance = v
		case float32:
			balance = float64(v)
		case int:
			balance = float64(v)
		case int64:
			balance = float64(v)
		default:
			err = fmt.Errorf("unsupported type: %T", v)
		}
		
		if err != nil {
			errors = append(errors, ValidationError{
				Field:   "current_balance",
				Message: "Invalid balance amount",
				Code:    "invalid",
			})
		} else if balance < 0 {
			errors = append(errors, ValidationError{
				Field:   "current_balance",
				Message: "Balance cannot be negative",
				Code:    "min",
			})
		} else {
			validatedData["current_balance"] = balance
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "current_balance",
			Message: "Current balance is required",
			Code:    "required",
		})
	}

	// Validate optional interest_rate
	if interestRateData, ok := data["interest_rate"]; ok && interestRateData != nil {
		// Skip empty strings
		if str, isStr := interestRateData.(string); isStr && str == "" {
			// Empty string means no interest rate, skip validation
		} else {
			var interestRate float64
			var err error
			
			switch v := interestRateData.(type) {
			case string:
				if v != "" {
					interestRate, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, skip
					goto skipInterestRate
				}
			case float64:
				interestRate = v
			case float32:
				interestRate = float64(v)
			case int:
				interestRate = float64(v)
			case int64:
				interestRate = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				errors = append(errors, ValidationError{
					Field:   "interest_rate",
					Message: "Invalid interest rate",
					Code:    "invalid",
				})
			} else if interestRate < -100 || interestRate > 100 {
				errors = append(errors, ValidationError{
					Field:   "interest_rate",
					Message: "Interest rate/return must be between -100 and 100",
					Code:    "range",
				})
			} else {
				validatedData["interest_rate"] = interestRate
			}
		}
		skipInterestRate:
	}

	// Validate optional monthly_contribution
	if monthlyContribData, ok := data["monthly_contribution"]; ok && monthlyContribData != nil {
		// Skip empty strings
		if str, isStr := monthlyContribData.(string); isStr && str == "" {
			// Empty string means no monthly contribution, skip validation
		} else {
			var monthlyContrib float64
			var err error
			
			switch v := monthlyContribData.(type) {
			case string:
				if v != "" {
					monthlyContrib, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, skip
					goto skipMonthlyContrib
				}
			case float64:
				monthlyContrib = v
			case float32:
				monthlyContrib = float64(v)
			case int:
				monthlyContrib = float64(v)
			case int64:
				monthlyContrib = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				errors = append(errors, ValidationError{
					Field:   "monthly_contribution",
					Message: "Invalid monthly contribution amount",
					Code:    "invalid",
				})
			} else if monthlyContrib < 0 {
				errors = append(errors, ValidationError{
					Field:   "monthly_contribution",
					Message: "Monthly contribution cannot be negative",
					Code:    "min",
				})
			} else {
				validatedData["monthly_contribution"] = monthlyContrib
			}
		}
		skipMonthlyContrib:
	}

	// Validate optional account_number_last4
	if last4Data, ok := data["account_number_last4"]; ok && last4Data != nil {
		if last4Str, ok := last4Data.(string); ok && last4Str != "" {
			last4Str = strings.TrimSpace(last4Str)
			if len(last4Str) != 4 {
				errors = append(errors, ValidationError{
					Field:   "account_number_last4",
					Message: "Last 4 digits must be exactly 4 characters",
					Code:    "length",
				})
			} else if !containsOnly(last4Str, "0123456789") {
				errors = append(errors, ValidationError{
					Field:   "account_number_last4",
					Message: "Last 4 digits must contain only numbers",
					Code:    "pattern",
				})
			} else {
				validatedData["account_number_last4"] = last4Str
			}
		}
	}

	// Validate currency
	validCurrencies := []string{"USD", "EUR", "GBP", "CAD"}
	if currency, ok := data["currency"].(string); ok {
		found := false
		for _, validCurrency := range validCurrencies {
			if currency == validCurrency {
				found = true
				break
			}
		}
		if !found {
			errors = append(errors, ValidationError{
				Field:   "currency",
				Message: "Invalid currency",
				Code:    "invalid",
			})
		} else {
			validatedData["currency"] = currency
		}
	} else {
		// Default to USD if not provided
		validatedData["currency"] = "USD"
	}

	// Validate optional notes
	if notesData, ok := data["notes"]; ok && notesData != nil {
		if notesStr, ok := notesData.(string); ok {
			notesStr = strings.TrimSpace(notesStr)
			if len(notesStr) > 500 {
				errors = append(errors, ValidationError{
					Field:   "notes",
					Message: "Notes must be 500 characters or less",
					Code:    "max_length",
				})
			} else if notesStr != "" {
				validatedData["notes"] = notesStr
			}
		}
	}

	return ValidationResult{
		Valid:  len(errors) == 0,
		Errors: errors,
		Data:   validatedData,
	}
}


// ProcessManualEntry processes and stores manual entry data
func (p *CashHoldingsPlugin) ProcessManualEntry(data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// Create unique account for this cash holding
	institutionName := validation.Data["institution_name"].(string)
	accountName := validation.Data["account_name"].(string)
	uniqueIdentifier := fmt.Sprintf("%s %s", institutionName, accountName)
	
	uniqueAccountID, err := GetOrCreateUniquePluginAccount(
		p.db,
		"Cash Holdings",
		uniqueIdentifier,
		"cash",
		institutionName,
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to create unique account for cash holding: %w", err)
	}

	// Insert the cash holding record
	query := `
		INSERT INTO cash_holdings (
			account_id, institution_name, account_name, account_type,
			current_balance, interest_rate, monthly_contribution,
			account_number_last4, currency, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	now := time.Now()
	_, err = p.db.Exec(
		query,
		uniqueAccountID,
		validation.Data["institution_name"],
		validation.Data["account_name"],
		validation.Data["account_type"],
		validation.Data["current_balance"],
		validation.Data["interest_rate"],
		validation.Data["monthly_contribution"],
		validation.Data["account_number_last4"],
		validation.Data["currency"],
		validation.Data["notes"],
		now,
		now,
	)

	if err != nil {
		return fmt.Errorf("failed to insert cash holding: %w", err)
	}

	p.lastUpdated = now
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *CashHoldingsPlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// Update the cash holding record
	query := `
		UPDATE cash_holdings SET
			institution_name = $2,
			account_name = $3,
			account_type = $4,
			current_balance = $5,
			interest_rate = $6,
			monthly_contribution = $7,
			account_number_last4 = $8,
			currency = $9,
			notes = $10,
			updated_at = $11
		WHERE id = $1
	`

	now := time.Now()
	result, err := p.db.Exec(
		query,
		id,
		validation.Data["institution_name"],
		validation.Data["account_name"],
		validation.Data["account_type"],
		validation.Data["current_balance"],
		validation.Data["interest_rate"],
		validation.Data["monthly_contribution"],
		validation.Data["account_number_last4"],
		validation.Data["currency"],
		validation.Data["notes"],
		now,
	)

	if err != nil {
		return fmt.Errorf("failed to update cash holding: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no cash holding found with id %d", id)
	}

	p.lastUpdated = now
	return nil
}

// BulkUpdateManualEntry updates multiple manual entries in a single transaction
func (p *CashHoldingsPlugin) BulkUpdateManualEntry(updates []BulkUpdateItem) error {
	if len(updates) == 0 {
		return nil
	}

	// Start a transaction
	tx, err := p.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()
	var successCount int
	var failedUpdates []BulkUpdateError

	for _, update := range updates {
		// First, fetch the existing record to merge with changes
		var existingData map[string]interface{}
		query := `
			SELECT institution_name, account_name, account_type, current_balance, 
			       interest_rate, monthly_contribution, account_number_last4, currency, notes
			FROM cash_holdings 
			WHERE id = $1
		`
		
		var institutionName, accountName, accountType, currency string
		var currentBalance float64
		var interestRate, monthlyContribution *float64
		var accountNumberLast4, notes *string
		
		err := tx.QueryRow(query, update.ID).Scan(
			&institutionName, &accountName, &accountType, &currentBalance,
			&interestRate, &monthlyContribution, &accountNumberLast4, &currency, &notes,
		)
		
		if err != nil {
			failedUpdates = append(failedUpdates, BulkUpdateError{
				ID:     update.ID,
				Error:  fmt.Sprintf("record not found: %v", err),
				Fields: update.Data,
			})
			continue
		}
		
		// Create complete data by merging existing with changes
		existingData = map[string]interface{}{
			"institution_name":     institutionName,
			"account_name":         accountName,
			"account_type":         accountType,
			"current_balance":      currentBalance,
			"currency":             currency,
		}
		
		if interestRate != nil {
			existingData["interest_rate"] = *interestRate
		}
		if monthlyContribution != nil {
			existingData["monthly_contribution"] = *monthlyContribution
		}
		if accountNumberLast4 != nil {
			existingData["account_number_last4"] = *accountNumberLast4
		}
		if notes != nil {
			existingData["notes"] = *notes
		}
		
		// Merge changes into existing data
		for key, value := range update.Data {
			existingData[key] = value
		}
		
		// Validate the complete merged data
		validation := p.ValidateManualEntry(existingData)
		if !validation.Valid {
			failedUpdates = append(failedUpdates, BulkUpdateError{
				ID:     update.ID,
				Error:  fmt.Sprintf("validation failed: %v", validation.Errors),
				Fields: update.Data,
			})
			continue
		}

		// Update the cash holding record
		updateQuery := `
			UPDATE cash_holdings SET
				institution_name = $2,
				account_name = $3,
				account_type = $4,
				current_balance = $5,
				interest_rate = $6,
				monthly_contribution = $7,
				account_number_last4 = $8,
				currency = $9,
				notes = $10,
				updated_at = $11
			WHERE id = $1
		`

		result, err := tx.Exec(
			updateQuery,
			update.ID,
			validation.Data["institution_name"],
			validation.Data["account_name"],
			validation.Data["account_type"],
			validation.Data["current_balance"],
			validation.Data["interest_rate"],
			validation.Data["monthly_contribution"],
			validation.Data["account_number_last4"],
			validation.Data["currency"],
			validation.Data["notes"],
			now,
		)

		if err != nil {
			failedUpdates = append(failedUpdates, BulkUpdateError{
				ID:     update.ID,
				Error:  fmt.Sprintf("database error: %v", err),
				Fields: update.Data,
			})
			continue
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			failedUpdates = append(failedUpdates, BulkUpdateError{
				ID:     update.ID,
				Error:  fmt.Sprintf("failed to check rows affected: %v", err),
				Fields: update.Data,
			})
			continue
		}

		if rowsAffected == 0 {
			failedUpdates = append(failedUpdates, BulkUpdateError{
				ID:     update.ID,
				Error:  fmt.Sprintf("no cash holding found with id %d", update.ID),
				Fields: update.Data,
			})
			continue
		}

		successCount++
	}

	// Commit the transaction if we have any successful updates
	if successCount > 0 {
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit transaction: %w", err)
		}
		p.lastUpdated = now
	}

	// Return error if there were any failures
	if len(failedUpdates) > 0 {
		return &BulkUpdateResult{
			SuccessCount: successCount,
			FailureCount: len(failedUpdates),
			Errors:       failedUpdates,
		}
	}

	return nil
}

// Helper function for strings.ContainsOnly (which doesn't exist in standard library)
func containsOnly(s, chars string) bool {
	for _, r := range s {
		if !strings.ContainsRune(chars, r) {
			return false
		}
	}
	return true
}