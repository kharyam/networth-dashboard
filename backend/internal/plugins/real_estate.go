package plugins

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// RealEstatePlugin handles manual entry for real estate properties
type RealEstatePlugin struct {
	db          *sql.DB
	name        string
	lastUpdated time.Time
}

// NewRealEstatePlugin creates a new Real Estate plugin
func NewRealEstatePlugin(db *sql.DB) *RealEstatePlugin {
	return &RealEstatePlugin{
		db:   db,
		name: "real_estate",
	}
}

// GetName returns the plugin name
func (p *RealEstatePlugin) GetName() string {
	return p.name
}

// GetType returns the plugin type
func (p *RealEstatePlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *RealEstatePlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *RealEstatePlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *RealEstatePlugin) GetDescription() string {
	return "Manual entry for real estate properties including homes, investment properties, and land"
}

// Initialize initializes the plugin with configuration
func (p *RealEstatePlugin) Initialize(config PluginConfig) error {
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *RealEstatePlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *RealEstatePlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *RealEstatePlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *RealEstatePlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          "real-estate-portfolio",
			Name:        "Real Estate Portfolio",
			Type:        "real_estate",
			Institution: "Manual Entry",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *RealEstatePlugin) GetBalances() ([]Balance, error) {
	// Calculate total property value
	query := `
		SELECT COALESCE(SUM(current_value), 0) as total_value
		FROM real_estate_properties 
		WHERE account_id = 'real-estate-portfolio'
	`
	
	var totalValue float64
	err := p.db.QueryRow(query).Scan(&totalValue)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate real estate value: %w", err)
	}

	return []Balance{
		{
			AccountID:  "real-estate-portfolio",
			Amount:     totalValue,
			Currency:   "USD",
			AsOfDate:   time.Now(),
			DataSource: "manual",
		},
	}, nil
}

// GetTransactions returns transactions for this plugin
func (p *RealEstatePlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// Could track property purchases, sales, and improvements as transactions
	return []Transaction{}, nil
}

// SupportsManualEntry returns true as this is a manual entry plugin
func (p *RealEstatePlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
func (p *RealEstatePlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{
		Name:        "Real Estate Property",
		Description: "Add or update real estate properties in your portfolio",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "property_type",
				Type:        "select",
				Label:       "Property Type",
				Description: "Type of real estate property",
				Required:    true,
				Options: []FieldOption{
					{Value: "primary_residence", Label: "Primary Residence"},
					{Value: "investment_property", Label: "Investment Property"},
					{Value: "vacation_home", Label: "Vacation Home"},
					{Value: "commercial", Label: "Commercial Property"},
					{Value: "land", Label: "Land/Lot"},
					{Value: "other", Label: "Other"},
				},
			},
			{
				Name:        "property_name",
				Type:        "text",
				Label:       "Property Name/Address",
				Description: "Name or address to identify this property",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(200),
				},
				Placeholder: "123 Main St, City, State",
			},
			{
				Name:        "purchase_price",
				Type:        "number",
				Label:       "Purchase Price",
				Description: "Original purchase price of the property",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(1),
				},
				Placeholder: "350000",
			},
			{
				Name:        "current_value",
				Type:        "number",
				Label:       "Current Market Value",
				Description: "Current estimated market value",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(1),
				},
				Placeholder: "450000",
			},
			{
				Name:        "outstanding_mortgage",
				Type:        "number",
				Label:       "Outstanding Mortgage Balance",
				Description: "Current mortgage balance (leave empty if paid off)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "200000",
			},
			{
				Name:        "purchase_date",
				Type:        "date",
				Label:       "Purchase Date",
				Description: "Date when property was purchased",
				Required:    true,
			},
			{
				Name:        "property_size_sqft",
				Type:        "number",
				Label:       "Property Size (sq ft)",
				Description: "Size of the property in square feet",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(1),
				},
				Placeholder: "2500",
			},
			{
				Name:        "lot_size_acres",
				Type:        "number",
				Label:       "Lot Size (acres)",
				Description: "Size of the lot in acres (optional)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0.01),
				},
				Placeholder: "0.25",
			},
			{
				Name:        "rental_income_monthly",
				Type:        "number",
				Label:       "Monthly Rental Income",
				Description: "Monthly rental income if this is an investment property",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "2500",
			},
			{
				Name:        "property_tax_annual",
				Type:        "number",
				Label:       "Annual Property Tax",
				Description: "Annual property tax amount",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "8000",
			},
			{
				Name:        "notes",
				Type:        "textarea",
				Label:       "Notes",
				Description: "Additional notes about this property",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(1000),
				},
				Placeholder: "Recent renovations, neighborhood details, etc.",
			},
		},
	}
}

// ValidateManualEntry validates manual entry data
func (p *RealEstatePlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
	result := ValidationResult{Valid: true}

	// Validate property type
	propertyType, ok := data["property_type"].(string)
	if !ok || propertyType == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "property_type",
			Message: "Property type is required",
			Code:    "required",
		})
	}

	// Validate property name
	propertyName, ok := data["property_name"].(string)
	if !ok || strings.TrimSpace(propertyName) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "property_name",
			Message: "Property name/address is required",
			Code:    "required",
		})
	} else {
		propertyName = strings.TrimSpace(propertyName)
		data["property_name"] = propertyName
	}

	// Validate purchase price
	purchasePrice, err := p.validateNumberField(data, "purchase_price", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	} else if purchasePrice <= 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "purchase_price",
			Message: "Purchase price must be greater than 0",
			Code:    "invalid_range",
		})
	}

	// Validate current value
	currentValue, err := p.validateNumberField(data, "current_value", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	} else if currentValue <= 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "current_value",
			Message: "Current value must be greater than 0",
			Code:    "invalid_range",
		})
	}

	// Validate outstanding mortgage (optional)
	if mortgageRaw, exists := data["outstanding_mortgage"]; exists && mortgageRaw != nil {
		mortgage, err := p.validateNumberField(data, "outstanding_mortgage", false)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		} else if mortgage < 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "outstanding_mortgage",
				Message: "Outstanding mortgage cannot be negative",
				Code:    "invalid_range",
			})
		} else if mortgage > currentValue {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "outstanding_mortgage",
				Message: "Outstanding mortgage cannot exceed current property value",
				Code:    "invalid_range",
			})
		}
	}

	// Validate purchase date
	if _, err := p.validateDateField(data, "purchase_date", true); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	}

	// Validate optional numeric fields
	optionalFields := []string{"property_size_sqft", "lot_size_acres", "rental_income_monthly", "property_tax_annual"}
	for _, field := range optionalFields {
		if fieldRaw, exists := data[field]; exists && fieldRaw != nil {
			if _, err := p.validateNumberField(data, field, false); err != nil {
				result.Valid = false
				result.Errors = append(result.Errors, *err)
			}
		}
	}

	result.Data = data
	return result
}

// ProcessManualEntry processes the manual entry data
func (p *RealEstatePlugin) ProcessManualEntry(data map[string]interface{}) error {
	propertyType := data["property_type"].(string)
	propertyName := data["property_name"].(string)
	purchasePrice := data["purchase_price"].(float64)
	currentValue := data["current_value"].(float64)
	
	var outstandingMortgage float64
	if om, exists := data["outstanding_mortgage"]; exists && om != nil {
		outstandingMortgage = om.(float64)
	}

	purchaseDate, _ := time.Parse("2006-01-02", data["purchase_date"].(string))

	// Optional fields
	var propertySizeSqft, lotSizeAcres, rentalIncomeMonthly, propertyTaxAnnual float64
	if ps, exists := data["property_size_sqft"]; exists && ps != nil {
		propertySizeSqft = ps.(float64)
	}
	if ls, exists := data["lot_size_acres"]; exists && ls != nil {
		lotSizeAcres = ls.(float64)
	}
	if ri, exists := data["rental_income_monthly"]; exists && ri != nil {
		rentalIncomeMonthly = ri.(float64)
	}
	if pt, exists := data["property_tax_annual"]; exists && pt != nil {
		propertyTaxAnnual = pt.(float64)
	}

	var notes string
	if n, exists := data["notes"]; exists && n != nil {
		notes = n.(string)
	}

	// Calculate equity
	equity := currentValue - outstandingMortgage

	// Insert or update real estate property
	query := `
		INSERT INTO real_estate_properties (
			account_id, property_type, property_name, purchase_price, current_value, 
			outstanding_mortgage, equity, purchase_date, property_size_sqft, 
			lot_size_acres, rental_income_monthly, property_tax_annual, notes, last_updated
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (account_id, property_name) DO UPDATE SET
			property_type = EXCLUDED.property_type,
			purchase_price = EXCLUDED.purchase_price,
			current_value = EXCLUDED.current_value,
			outstanding_mortgage = EXCLUDED.outstanding_mortgage,
			equity = EXCLUDED.equity,
			property_size_sqft = EXCLUDED.property_size_sqft,
			lot_size_acres = EXCLUDED.lot_size_acres,
			rental_income_monthly = EXCLUDED.rental_income_monthly,
			property_tax_annual = EXCLUDED.property_tax_annual,
			notes = EXCLUDED.notes,
			last_updated = EXCLUDED.last_updated
	`

	now := time.Now()
	_, err := p.db.Exec(query,
		"real-estate-portfolio", propertyType, propertyName, purchasePrice, currentValue,
		outstandingMortgage, equity, purchaseDate, propertySizeSqft,
		lotSizeAcres, rentalIncomeMonthly, propertyTaxAnnual, notes, now,
	)

	if err != nil {
		return fmt.Errorf("failed to save real estate property: %w", err)
	}

	p.lastUpdated = now
	return nil
}

// RefreshData refreshes data for this plugin
func (p *RealEstatePlugin) RefreshData() error {
	// For manual entry, could potentially update property values from external APIs
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *RealEstatePlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}

// Helper methods for validation
func (p *RealEstatePlugin) validateNumberField(data map[string]interface{}, field string, required bool) (float64, *ValidationError) {
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
		var err error
		num, err = strconv.ParseFloat(v, 64)
		if err != nil {
			return 0, &ValidationError{
				Field:   field,
				Message: fmt.Sprintf("%s must be a valid number", field),
				Code:    "invalid_number",
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

func (p *RealEstatePlugin) validateDateField(data map[string]interface{}, field string, required bool) (time.Time, *ValidationError) {
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