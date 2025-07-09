package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// CryptoHoldingsPlugin handles manual entry for cryptocurrency holdings
type CryptoHoldingsPlugin struct {
	db          *sql.DB
	name        string
	accountID   int
	lastUpdated time.Time
}

// NewCryptoHoldingsPlugin creates a new Crypto Holdings plugin
func NewCryptoHoldingsPlugin(db *sql.DB) *CryptoHoldingsPlugin {
	return &CryptoHoldingsPlugin{
		db:   db,
		name: "crypto_holdings",
	}
}

// GetName returns the plugin name
func (p *CryptoHoldingsPlugin) GetName() string {
	return p.name
}

// GetFriendlyName returns the user-friendly plugin name
func (p *CryptoHoldingsPlugin) GetFriendlyName() string {
	return "Crypto Holdings"
}

// GetType returns the plugin type
func (p *CryptoHoldingsPlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *CryptoHoldingsPlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *CryptoHoldingsPlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *CryptoHoldingsPlugin) GetDescription() string {
	return "Manual entry for cryptocurrency holdings including Bitcoin, Ethereum, and other digital assets"
}

// Initialize initializes the plugin with configuration
func (p *CryptoHoldingsPlugin) Initialize(config PluginConfig) error {
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Crypto Holdings Portfolio",
		"crypto_holdings",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize Crypto Holdings account: %w", err)
	}

	p.accountID = accountID
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *CryptoHoldingsPlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *CryptoHoldingsPlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *CryptoHoldingsPlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *CryptoHoldingsPlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          fmt.Sprintf("%d", p.accountID),
			Name:        "Crypto Holdings Portfolio",
			Type:        "crypto_holdings",
			Institution: "Manual Entry",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *CryptoHoldingsPlugin) GetBalances() ([]Balance, error) {
	var balances []Balance

	query := `
		SELECT ch.crypto_symbol, ch.balance_tokens, cp.price_usd, ch.updated_at
		FROM crypto_holdings ch
		LEFT JOIN crypto_prices cp ON ch.crypto_symbol = cp.symbol
		WHERE ch.account_id = $1
		AND (cp.last_updated IS NULL OR cp.last_updated = (
			SELECT MAX(last_updated)
			FROM crypto_prices cp2
			WHERE cp2.symbol = ch.crypto_symbol
		))
	`

	rows, err := p.db.Query(query, p.accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to query crypto holdings balances: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var symbol string
		var tokens float64
		var priceUSD sql.NullFloat64
		var updatedAt time.Time

		err := rows.Scan(&symbol, &tokens, &priceUSD, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan crypto holding balance: %w", err)
		}

		amount := 0.0
		if priceUSD.Valid {
			amount = tokens * priceUSD.Float64
		}

		balance := Balance{
			AccountID:  fmt.Sprintf("%d", p.accountID),
			Amount:     amount,
			Currency:   "USD",
			AsOfDate:   updatedAt,
			DataSource: "manual",
		}
		balances = append(balances, balance)
	}

	return balances, nil
}

// GetTransactions returns transactions for this plugin
func (p *CryptoHoldingsPlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// Crypto holdings typically don't have detailed transaction data in manual entry
	// This could be extended in the future to track buys/sells
	return []Transaction{}, nil
}

// RefreshData refreshes plugin data (not applicable for manual entry)
func (p *CryptoHoldingsPlugin) RefreshData() error {
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *CryptoHoldingsPlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}

// SupportsManualEntry returns true as this plugin supports manual data entry
func (p *CryptoHoldingsPlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *CryptoHoldingsPlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Crypto Holdings",
		Description: "Add or update cryptocurrency holdings in your portfolio",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "institution_name",
				Type:        "text",
				Label:       "Institution/Exchange Name",
				Description: "Name of the exchange, wallet, or institution holding the crypto",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(100),
				},
				Placeholder: "Coinbase, Kraken, Hardware Wallet",
			},
			{
				Name:        "crypto_symbol",
				Type:        "text",
				Label:       "Crypto Symbol",
				Description: "Symbol of the cryptocurrency (e.g., BTC, ETH, ADA)",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(20),
				},
				Placeholder: "BTC",
			},
			{
				Name:        "balance_tokens",
				Type:        "number",
				Label:       "Balance (Tokens)",
				Description: "Number of tokens/coins held",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "1.5",
			},
			{
				Name:        "purchase_price_usd",
				Type:        "number",
				Label:       "Purchase Price (USD)",
				Description: "Average purchase price per token in USD (optional)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "35000",
			},
			{
				Name:        "purchase_date",
				Type:        "date",
				Label:       "Purchase Date",
				Description: "Date when the crypto was purchased (optional)",
				Required:    false,
				Placeholder: "2023-01-15",
			},
			{
				Name:        "wallet_address",
				Type:        "text",
				Label:       "Wallet Address",
				Description: "Wallet address (last 8 characters for identification)",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(255),
				},
				Placeholder: "...a1b2c3d4",
			},
			{
				Name:        "staking_annual_percentage",
				Type:        "number",
				Label:       "Annual Staking Percentage",
				Description: "Annual percentage earned from staking (0 means not staked)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
					Max: func(f float64) *float64 { return &f }(100),
				},
				DefaultValue: 0,
				Placeholder: "5.0",
			},
			{
				Name:        "notes",
				Type:        "textarea",
				Label:       "Notes",
				Description: "Additional notes about this holding",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(500),
				},
				Placeholder: "Any additional notes about this crypto holding...",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *CryptoHoldingsPlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
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

	// Validate crypto_symbol
	if cryptoSymbol, ok := data["crypto_symbol"].(string); ok {
		cryptoSymbol = strings.TrimSpace(strings.ToUpper(cryptoSymbol))
		if cryptoSymbol == "" {
			errors = append(errors, ValidationError{
				Field:   "crypto_symbol",
				Message: "Crypto symbol is required",
				Code:    "required",
			})
		} else if len(cryptoSymbol) > 20 {
			errors = append(errors, ValidationError{
				Field:   "crypto_symbol",
				Message: "Crypto symbol must be 20 characters or less",
				Code:    "max_length",
			})
		} else {
			validatedData["crypto_symbol"] = cryptoSymbol
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "crypto_symbol",
			Message: "Crypto symbol is required",
			Code:    "required",
		})
	}

	// Validate balance_tokens
	if balanceData, exists := data["balance_tokens"]; exists && balanceData != nil {
		var balance float64
		var err error
		
		switch v := balanceData.(type) {
		case string:
			if v == "" {
				errors = append(errors, ValidationError{
					Field:   "balance_tokens",
					Message: "Balance is required",
					Code:    "required",
				})
			} else {
				balance, err = strconv.ParseFloat(v, 64)
				if err != nil {
					errors = append(errors, ValidationError{
						Field:   "balance_tokens",
						Message: "Invalid balance amount",
						Code:    "invalid",
					})
				}
			}
		case float64:
			balance = v
		case float32:
			balance = float64(v)
		case int:
			balance = float64(v)
		case int64:
			balance = float64(v)
		default:
			errors = append(errors, ValidationError{
				Field:   "balance_tokens",
				Message: "Invalid balance amount",
				Code:    "invalid",
			})
		}
		
		if err == nil && balance < 0 {
			errors = append(errors, ValidationError{
				Field:   "balance_tokens",
				Message: "Balance cannot be negative",
				Code:    "min",
			})
		} else if err == nil {
			validatedData["balance_tokens"] = balance
		}
	} else {
		errors = append(errors, ValidationError{
			Field:   "balance_tokens",
			Message: "Balance is required",
			Code:    "required",
		})
	}

	// Validate optional purchase_price_usd
	if purchasePriceData, exists := data["purchase_price_usd"]; exists && purchasePriceData != nil {
		// Skip empty strings for optional fields
		if str, isStr := purchasePriceData.(string); isStr && str == "" {
			// Empty string means no purchase price, skip validation
		} else {
			var purchasePrice float64
			var err error
			
			switch v := purchasePriceData.(type) {
			case string:
				if v != "" {
					purchasePrice, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, skip
					goto skipPurchasePrice
				}
			case float64:
				purchasePrice = v
			case float32:
				purchasePrice = float64(v)
			case int:
				purchasePrice = float64(v)
			case int64:
				purchasePrice = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				errors = append(errors, ValidationError{
					Field:   "purchase_price_usd",
					Message: "Invalid purchase price",
					Code:    "invalid",
				})
			} else if purchasePrice < 0 {
				errors = append(errors, ValidationError{
					Field:   "purchase_price_usd",
					Message: "Purchase price cannot be negative",
					Code:    "min",
				})
			} else {
				validatedData["purchase_price_usd"] = purchasePrice
			}
		}
		skipPurchasePrice:
	}

	// Validate optional purchase_date
	if purchaseDateData, ok := data["purchase_date"]; ok && purchaseDateData != nil {
		if purchaseDateStr, ok := purchaseDateData.(string); ok && purchaseDateStr != "" {
			// Basic date format validation (YYYY-MM-DD)
			if len(purchaseDateStr) == 10 && purchaseDateStr[4] == '-' && purchaseDateStr[7] == '-' {
				validatedData["purchase_date"] = purchaseDateStr
			} else {
				errors = append(errors, ValidationError{
					Field:   "purchase_date",
					Message: "Invalid date format (use YYYY-MM-DD)",
					Code:    "invalid",
				})
			}
		}
	}

	// Validate optional wallet_address
	if walletAddressData, ok := data["wallet_address"]; ok && walletAddressData != nil {
		if walletAddressStr, ok := walletAddressData.(string); ok {
			walletAddressStr = strings.TrimSpace(walletAddressStr)
			if len(walletAddressStr) > 255 {
				errors = append(errors, ValidationError{
					Field:   "wallet_address",
					Message: "Wallet address must be 255 characters or less",
					Code:    "max_length",
				})
			} else if walletAddressStr != "" {
				validatedData["wallet_address"] = walletAddressStr
			}
		}
	}

	// Validate optional staking_annual_percentage
	if stakingData, exists := data["staking_annual_percentage"]; exists && stakingData != nil {
		// Skip empty strings for optional fields
		if str, isStr := stakingData.(string); isStr && str == "" {
			// Empty string means no staking, set to default 0
			validatedData["staking_annual_percentage"] = 0.0
		} else {
			var stakingPercentage float64
			var err error
			
			switch v := stakingData.(type) {
			case string:
				if v != "" {
					stakingPercentage, err = strconv.ParseFloat(v, 64)
				} else {
					// Empty string, set to 0
					stakingPercentage = 0.0
				}
			case float64:
				stakingPercentage = v
			case float32:
				stakingPercentage = float64(v)
			case int:
				stakingPercentage = float64(v)
			case int64:
				stakingPercentage = float64(v)
			default:
				err = fmt.Errorf("unsupported type: %T", v)
			}
			
			if err != nil {
				errors = append(errors, ValidationError{
					Field:   "staking_annual_percentage",
					Message: "Invalid staking percentage",
					Code:    "invalid",
				})
			} else if stakingPercentage < 0 {
				errors = append(errors, ValidationError{
					Field:   "staking_annual_percentage",
					Message: "Staking percentage cannot be negative",
					Code:    "min",
				})
			} else if stakingPercentage > 100 {
				errors = append(errors, ValidationError{
					Field:   "staking_annual_percentage",
					Message: "Staking percentage cannot exceed 100%",
					Code:    "max",
				})
			} else {
				validatedData["staking_annual_percentage"] = stakingPercentage
			}
		}
	} else {
		// Field not provided, set default value
		validatedData["staking_annual_percentage"] = 0.0
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
func (p *CryptoHoldingsPlugin) ProcessManualEntry(data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// Create unique account for this crypto holding
	institutionName := validation.Data["institution_name"].(string)
	cryptoSymbol := validation.Data["crypto_symbol"].(string)
	uniqueIdentifier := fmt.Sprintf("%s %s", institutionName, cryptoSymbol)
	
	uniqueAccountID, err := GetOrCreateUniquePluginAccount(
		p.db,
		"Crypto Holdings",
		uniqueIdentifier,
		"crypto",
		institutionName,
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to create unique account for crypto holding: %w", err)
	}

	// Insert the crypto holding record
	query := `
		INSERT INTO crypto_holdings (
			account_id, institution_name, crypto_symbol, balance_tokens,
			purchase_price_usd, purchase_date, wallet_address, notes,
			staking_annual_percentage, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	now := time.Now()
	_, err = p.db.Exec(
		query,
		uniqueAccountID,
		validation.Data["institution_name"],
		validation.Data["crypto_symbol"],
		validation.Data["balance_tokens"],
		validation.Data["purchase_price_usd"],
		validation.Data["purchase_date"],
		validation.Data["wallet_address"],
		validation.Data["notes"],
		validation.Data["staking_annual_percentage"],
		now,
		now,
	)

	if err != nil {
		return fmt.Errorf("failed to insert crypto holding: %w", err)
	}

	p.lastUpdated = now
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *CryptoHoldingsPlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// First, get the actual account ID for this crypto holding
	var actualAccountID int
	accountQuery := `SELECT account_id FROM crypto_holdings WHERE id = $1`
	err := p.db.QueryRow(accountQuery, id).Scan(&actualAccountID)
	if err != nil {
		return fmt.Errorf("failed to get crypto holding account ID: %w", err)
	}

	// Update the crypto holding record
	query := `
		UPDATE crypto_holdings SET
			institution_name = $2,
			crypto_symbol = $3,
			balance_tokens = $4,
			purchase_price_usd = $5,
			purchase_date = $6,
			wallet_address = $7,
			notes = $8,
			staking_annual_percentage = $9,
			updated_at = $10
		WHERE id = $1
	`

	now := time.Now()
	result, err := p.db.Exec(
		query,
		id,
		validation.Data["institution_name"],
		validation.Data["crypto_symbol"],
		validation.Data["balance_tokens"],
		validation.Data["purchase_price_usd"],
		validation.Data["purchase_date"],
		validation.Data["wallet_address"],
		validation.Data["notes"],
		validation.Data["staking_annual_percentage"],
		now,
	)

	if err != nil {
		return fmt.Errorf("failed to update crypto holding: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no crypto holding found with id %d", id)
	}

	p.lastUpdated = now
	return nil
}