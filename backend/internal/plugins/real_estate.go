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
	accountID   int
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

// GetFriendlyName returns the user-friendly plugin name
func (p *RealEstatePlugin) GetFriendlyName() string {
	return "Real Estate"
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
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Real Estate Portfolio",
		"real_estate",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize Real Estate account: %w", err)
	}

	p.accountID = accountID
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
			ID:          fmt.Sprintf("%d", p.accountID),
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
		WHERE account_id = $1
	`

	var totalValue float64
	err := p.db.QueryRow(query, p.accountID).Scan(&totalValue)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate real estate value: %w", err)
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
				Label:       "Property Name/Description",
				Description: "Name or description to identify this property",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(200),
				},
				Placeholder: "My Primary Home, Beach House, etc.",
			},
			{
				Name:        "street_address",
				Type:        "text",
				Label:       "Street Address",
				Description: "Street address of the property",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(200),
				},
				Placeholder: "123 Main Street",
			},
			{
				Name:        "city",
				Type:        "text",
				Label:       "City",
				Description: "City where the property is located",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(100),
				},
				Placeholder: "Los Angeles",
			},
			{
				Name:        "state",
				Type:        "select",
				Label:       "State",
				Description: "US state where the property is located",
				Required:    false,
				Options: []FieldOption{
					{Value: "", Label: "Select State"},
					{Value: "AL", Label: "Alabama"},
					{Value: "AK", Label: "Alaska"},
					{Value: "AZ", Label: "Arizona"},
					{Value: "AR", Label: "Arkansas"},
					{Value: "CA", Label: "California"},
					{Value: "CO", Label: "Colorado"},
					{Value: "CT", Label: "Connecticut"},
					{Value: "DE", Label: "Delaware"},
					{Value: "FL", Label: "Florida"},
					{Value: "GA", Label: "Georgia"},
					{Value: "HI", Label: "Hawaii"},
					{Value: "ID", Label: "Idaho"},
					{Value: "IL", Label: "Illinois"},
					{Value: "IN", Label: "Indiana"},
					{Value: "IA", Label: "Iowa"},
					{Value: "KS", Label: "Kansas"},
					{Value: "KY", Label: "Kentucky"},
					{Value: "LA", Label: "Louisiana"},
					{Value: "ME", Label: "Maine"},
					{Value: "MD", Label: "Maryland"},
					{Value: "MA", Label: "Massachusetts"},
					{Value: "MI", Label: "Michigan"},
					{Value: "MN", Label: "Minnesota"},
					{Value: "MS", Label: "Mississippi"},
					{Value: "MO", Label: "Missouri"},
					{Value: "MT", Label: "Montana"},
					{Value: "NE", Label: "Nebraska"},
					{Value: "NV", Label: "Nevada"},
					{Value: "NH", Label: "New Hampshire"},
					{Value: "NJ", Label: "New Jersey"},
					{Value: "NM", Label: "New Mexico"},
					{Value: "NY", Label: "New York"},
					{Value: "NC", Label: "North Carolina"},
					{Value: "ND", Label: "North Dakota"},
					{Value: "OH", Label: "Ohio"},
					{Value: "OK", Label: "Oklahoma"},
					{Value: "OR", Label: "Oregon"},
					{Value: "PA", Label: "Pennsylvania"},
					{Value: "RI", Label: "Rhode Island"},
					{Value: "SC", Label: "South Carolina"},
					{Value: "SD", Label: "South Dakota"},
					{Value: "TN", Label: "Tennessee"},
					{Value: "TX", Label: "Texas"},
					{Value: "UT", Label: "Utah"},
					{Value: "VT", Label: "Vermont"},
					{Value: "VA", Label: "Virginia"},
					{Value: "WA", Label: "Washington"},
					{Value: "WV", Label: "West Virginia"},
					{Value: "WI", Label: "Wisconsin"},
					{Value: "WY", Label: "Wyoming"},
					{Value: "DC", Label: "District of Columbia"},
				},
			},
			{
				Name:        "zip_code",
				Type:        "text",
				Label:       "ZIP Code",
				Description: "ZIP code of the property",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(10),
				},
				Placeholder: "90210",
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

	// Extract address fields
	var streetAddress, city, state, zipCode string
	if sa, exists := data["street_address"]; exists && sa != nil {
		streetAddress = sa.(string)
	}
	if c, exists := data["city"]; exists && c != nil {
		city = c.(string)
	}
	if s, exists := data["state"]; exists && s != nil {
		state = s.(string)
	}
	if zc, exists := data["zip_code"]; exists && zc != nil {
		zipCode = zc.(string)
	}

	// Create unique account for this property
	uniqueAccountID, err := GetOrCreateUniquePluginAccount(
		p.db,
		"Real Estate",
		propertyName,
		"real_estate",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to create unique account for property: %w", err)
	}

	// Insert real estate property
	query := `
		INSERT INTO real_estate_properties (
			account_id, property_type, property_name, street_address, city, state, zip_code,
			purchase_price, current_value, outstanding_mortgage, equity, purchase_date, 
			property_size_sqft, lot_size_acres, rental_income_monthly, property_tax_annual, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`

	_, err = p.db.Exec(query,
		uniqueAccountID, propertyType, propertyName, streetAddress, city, state, zipCode,
		purchasePrice, currentValue, outstandingMortgage, equity, purchaseDate, 
		propertySizeSqft, lotSizeAcres, rentalIncomeMonthly, propertyTaxAnnual, notes,
	)

	if err != nil {
		return fmt.Errorf("failed to save real estate property: %w", err)
	}

	p.lastUpdated = time.Now()
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *RealEstatePlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	propertyType := data["property_type"].(string)
	propertyName := data["property_name"].(string)
	purchasePrice := data["purchase_price"].(float64)
	currentValue := data["current_value"].(float64)
	outstandingMortgage := data["outstanding_mortgage"].(float64)
	equity := currentValue - outstandingMortgage

	purchaseDate, _ := time.Parse("2006-01-02", data["purchase_date"].(string))

	// Handle optional fields
	var propertySizeSqft, lotSizeAcres, rentalIncomeMonthly, propertyTaxAnnual *float64
	var notes *string

	if val, exists := data["property_size_sqft"]; exists && val != nil {
		if v, ok := val.(float64); ok && v >= 0 {
			propertySizeSqft = &v
		}
	}

	if val, exists := data["lot_size_acres"]; exists && val != nil {
		if v, ok := val.(float64); ok && v >= 0 {
			lotSizeAcres = &v
		}
	}

	if val, exists := data["rental_income_monthly"]; exists && val != nil {
		if v, ok := val.(float64); ok && v >= 0 {
			rentalIncomeMonthly = &v
		}
	}

	if val, exists := data["property_tax_annual"]; exists && val != nil {
		if v, ok := val.(float64); ok && v >= 0 {
			propertyTaxAnnual = &v
		}
	}

	if val, exists := data["notes"]; exists && val != nil {
		if v, ok := val.(string); ok && v != "" {
			notes = &v
		}
	}

	// Extract address fields
	var streetAddress, city, state, zipCode *string
	if val, exists := data["street_address"]; exists && val != nil {
		if v, ok := val.(string); ok && v != "" {
			streetAddress = &v
		}
	}
	if val, exists := data["city"]; exists && val != nil {
		if v, ok := val.(string); ok && v != "" {
			city = &v
		}
	}
	if val, exists := data["state"]; exists && val != nil {
		if v, ok := val.(string); ok && v != "" {
			state = &v
		}
	}
	if val, exists := data["zip_code"]; exists && val != nil {
		if v, ok := val.(string); ok && v != "" {
			zipCode = &v
		}
	}

	// Update real estate property
	query := `
		UPDATE real_estate_properties 
		SET property_type = $1, property_name = $2, street_address = $3, city = $4, state = $5, 
		    zip_code = $6, purchase_price = $7, current_value = $8, outstanding_mortgage = $9, 
		    equity = $10, purchase_date = $11, property_size_sqft = $12, lot_size_acres = $13, 
		    rental_income_monthly = $14, property_tax_annual = $15, notes = $16, last_updated = $17
		WHERE id = $18
	`

	result, err := p.db.Exec(query,
		propertyType, propertyName, streetAddress, city, state, zipCode,
		purchasePrice, currentValue, outstandingMortgage, equity, purchaseDate, 
		propertySizeSqft, lotSizeAcres, rentalIncomeMonthly, propertyTaxAnnual, notes,
		time.Now(), id,
	)

	if err != nil {
		return fmt.Errorf("failed to update real estate property: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check update result: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("real estate property not found")
	}

	p.lastUpdated = time.Now()
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

	// Handle null values for optional fields
	if value == nil {
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
			}
			// Convert empty string to null in data
			data[field] = nil
			return 0, nil
		}
		
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
