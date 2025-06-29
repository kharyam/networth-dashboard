package plugins

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// OtherAssetsPlugin handles manual entry for miscellaneous assets
type OtherAssetsPlugin struct {
	db          *sql.DB
	name        string
	accountID   int
	lastUpdated time.Time
}

// NewOtherAssetsPlugin creates a new Other Assets plugin
func NewOtherAssetsPlugin(db *sql.DB) *OtherAssetsPlugin {
	return &OtherAssetsPlugin{
		db:   db,
		name: "other_assets",
	}
}

// GetName returns the plugin name
func (p *OtherAssetsPlugin) GetName() string {
	return p.name
}

// GetFriendlyName returns the user-friendly plugin name
func (p *OtherAssetsPlugin) GetFriendlyName() string {
	return "Other Assets"
}

// GetType returns the plugin type
func (p *OtherAssetsPlugin) GetType() PluginType {
	return PluginTypeManual
}

// GetDataSource returns the data source type
func (p *OtherAssetsPlugin) GetDataSource() DataSourceType {
	return DataSourceManual
}

// GetVersion returns the plugin version
func (p *OtherAssetsPlugin) GetVersion() string {
	return "1.0.0"
}

// GetDescription returns the plugin description
func (p *OtherAssetsPlugin) GetDescription() string {
	return "Manual entry for miscellaneous assets including vehicles, jewelry, art, business interests, and intellectual property"
}

// Initialize initializes the plugin with configuration
func (p *OtherAssetsPlugin) Initialize(config PluginConfig) error {
	// Get or create the plugin account
	accountID, err := GetOrCreatePluginAccount(
		p.db,
		"Other Assets Portfolio",
		"other_assets",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to initialize Other Assets account: %w", err)
	}

	p.accountID = accountID
	return nil
}

// Authenticate performs authentication (not needed for manual entry)
func (p *OtherAssetsPlugin) Authenticate() error {
	return nil
}

// Disconnect disconnects from the service (not needed for manual entry)
func (p *OtherAssetsPlugin) Disconnect() error {
	return nil
}

// IsHealthy returns the health status of the plugin
func (p *OtherAssetsPlugin) IsHealthy() PluginHealth {
	return PluginHealth{
		Status:      PluginStatusActive,
		LastChecked: time.Now(),
		Metrics: PluginMetrics{
			SuccessRate: 1.0,
		},
	}
}

// GetAccounts returns accounts for this plugin
func (p *OtherAssetsPlugin) GetAccounts() ([]Account, error) {
	return []Account{
		{
			ID:          fmt.Sprintf("%d", p.accountID),
			Name:        "Other Assets Portfolio",
			Type:        "other_assets",
			Institution: "Manual Entry",
			DataSource:  "manual",
			LastUpdated: p.lastUpdated,
		},
	}, nil
}

// GetBalances returns balances for this plugin
func (p *OtherAssetsPlugin) GetBalances() ([]Balance, error) {
	// Calculate total other assets value
	query := `
		SELECT COALESCE(SUM(current_value - COALESCE(amount_owed, 0)), 0) as total_equity
		FROM miscellaneous_assets 
		WHERE account_id = $1
	`

	var totalEquity float64
	err := p.db.QueryRow(query, p.accountID).Scan(&totalEquity)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate other assets value: %w", err)
	}

	return []Balance{
		{
			AccountID:  fmt.Sprintf("%d", p.accountID),
			Amount:     totalEquity,
			Currency:   "USD",
			AsOfDate:   time.Now(),
			DataSource: "manual",
		},
	}, nil
}

// GetTransactions returns transactions for this plugin
func (p *OtherAssetsPlugin) GetTransactions(dateRange DateRange) ([]Transaction, error) {
	// Could track purchases, sales, and value adjustments as transactions
	return []Transaction{}, nil
}

// SupportsManualEntry returns true as this is a manual entry plugin
func (p *OtherAssetsPlugin) SupportsManualEntry() bool {
	return true
}

// GetManualEntrySchema returns the schema for manual data entry
// This will be dynamically generated based on the selected asset category
func (p *OtherAssetsPlugin) GetManualEntrySchema() ManualEntrySchema {
	// Base schema - will be extended dynamically based on category selection
	return ManualEntrySchema{
		Name:        "Other Asset",
		Description: "Add miscellaneous assets to your portfolio",
		Version:     "1.0.0",
		Fields: []FieldSpec{
			{
				Name:        "asset_category_id",
				Type:        "select",
				Label:       "Asset Category",
				Description: "Select the type of asset you're adding",
				Required:    true,
				Options:     p.getAssetCategoryOptions(),
			},
			{
				Name:        "asset_name",
				Type:        "text",
				Label:       "Asset Name",
				Description: "Name or description to identify this asset",
				Required:    true,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(200),
				},
				Placeholder: "My 2018 Honda Civic, Wedding Ring, etc.",
			},
			{
				Name:        "current_value",
				Type:        "number",
				Label:       "Current Market Value",
				Description: "Current estimated value of the asset",
				Required:    true,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "25000",
			},
			{
				Name:        "purchase_price",
				Type:        "number",
				Label:       "Purchase Price",
				Description: "Original purchase price (optional)",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "20000",
			},
			{
				Name:        "amount_owed",
				Type:        "number",
				Label:       "Amount Owed",
				Description: "Outstanding loan or debt against this asset",
				Required:    false,
				Validation: FieldValidation{
					Min: func(f float64) *float64 { return &f }(0),
				},
				Placeholder: "5000",
			},
			{
				Name:        "purchase_date",
				Type:        "date",
				Label:       "Purchase Date",
				Description: "Date when the asset was acquired",
				Required:    false,
			},
			{
				Name:        "description",
				Type:        "textarea",
				Label:       "Description",
				Description: "Additional details about this asset",
				Required:    false,
				Validation: FieldValidation{
					MaxLength: func(i int) *int { return &i }(1000),
				},
				Placeholder: "Additional details, condition, notes, etc.",
			},
		},
	}
}

// GetManualEntrySchemaForCategory returns the schema with custom fields for a specific category
func (p *OtherAssetsPlugin) GetManualEntrySchemaForCategory(categoryID int) (ManualEntrySchema, error) {
	// Start with base schema
	schema := p.GetManualEntrySchema()
	
	// Get custom schema for the category
	var customSchemaJSON sql.NullString
	query := "SELECT custom_schema FROM asset_categories WHERE id = $1 AND is_active = true"
	err := p.db.QueryRow(query, categoryID).Scan(&customSchemaJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return schema, fmt.Errorf("category not found")
		}
		return schema, fmt.Errorf("failed to fetch category schema: %v", err)
	}
	
	// If no custom schema, return base schema
	if !customSchemaJSON.Valid {
		return schema, nil
	}
	
	// Parse custom schema
	var customSchema struct {
		Fields []struct {
			Name        string                   `json:"name"`
			Type        string                   `json:"type"`
			Label       string                   `json:"label"`
			Required    bool                     `json:"required"`
			Options     []map[string]interface{} `json:"options,omitempty"`
			Validation  map[string]interface{}   `json:"validation,omitempty"`
			Placeholder string                   `json:"placeholder,omitempty"`
		} `json:"fields"`
	}
	
	if err := json.Unmarshal([]byte(customSchemaJSON.String), &customSchema); err != nil {
		return schema, fmt.Errorf("failed to parse custom schema: %v", err)
	}
	
	// Convert custom fields to FieldSpec format
	for _, customField := range customSchema.Fields {
		field := FieldSpec{
			Name:        fmt.Sprintf("custom_fields.%s", customField.Name),
			Type:        customField.Type,
			Label:       customField.Label,
			Required:    customField.Required,
			Placeholder: customField.Placeholder,
		}
		
		// Convert options if present
		if len(customField.Options) > 0 {
			for _, opt := range customField.Options {
				if value, ok := opt["value"].(string); ok {
					if label, ok := opt["label"].(string); ok {
						field.Options = append(field.Options, FieldOption{
							Value: value,
							Label: label,
						})
					}
				}
			}
		}
		
		// Convert validation if present
		if customField.Validation != nil {
			validation := FieldValidation{}
			if minVal, ok := customField.Validation["min"]; ok {
				if minFloat, ok := minVal.(float64); ok {
					validation.Min = &minFloat
				}
			}
			if maxVal, ok := customField.Validation["max"]; ok {
				if maxFloat, ok := maxVal.(float64); ok {
					validation.Max = &maxFloat
				}
			}
			field.Validation = validation
		}
		
		schema.Fields = append(schema.Fields, field)
	}
	
	return schema, nil
}

// getAssetCategoryOptions fetches available asset categories from database
func (p *OtherAssetsPlugin) getAssetCategoryOptions() []FieldOption {
	query := `
		SELECT id, name FROM asset_categories 
		WHERE is_active = true 
		ORDER BY sort_order, name
	`

	rows, err := p.db.Query(query)
	if err != nil {
		// Return empty if can't fetch categories
		return []FieldOption{}
	}
	defer rows.Close()

	var options []FieldOption
	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			continue
		}
		options = append(options, FieldOption{
			Value: fmt.Sprintf("%d", id),
			Label: name,
		})
	}

	return options
}

// ValidateManualEntry validates manual entry data
func (p *OtherAssetsPlugin) ValidateManualEntry(data map[string]interface{}) ValidationResult {
	result := ValidationResult{Valid: true}

	// Validate asset category
	categoryID, err := p.validateNumberField(data, "asset_category_id", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	}

	// Validate asset name
	assetName, ok := data["asset_name"].(string)
	if !ok || strings.TrimSpace(assetName) == "" {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "asset_name",
			Message: "Asset name is required",
			Code:    "required",
		})
	} else {
		assetName = strings.TrimSpace(assetName)
		data["asset_name"] = assetName
	}

	// Validate current value
	currentValue, err := p.validateNumberField(data, "current_value", true)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	} else if currentValue < 0 {
		result.Valid = false
		result.Errors = append(result.Errors, ValidationError{
			Field:   "current_value",
			Message: "Current value cannot be negative",
			Code:    "invalid_range",
		})
	}

	// Validate optional purchase price
	if purchasePriceRaw, exists := data["purchase_price"]; exists && purchasePriceRaw != nil {
		purchasePrice, err := p.validateNumberField(data, "purchase_price", false)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		} else if purchasePrice < 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "purchase_price",
				Message: "Purchase price cannot be negative",
				Code:    "invalid_range",
			})
		}
	}

	// Validate optional amount owed
	if amountOwedRaw, exists := data["amount_owed"]; exists && amountOwedRaw != nil {
		amountOwed, err := p.validateNumberField(data, "amount_owed", false)
		if err != nil {
			result.Valid = false
			result.Errors = append(result.Errors, *err)
		} else if amountOwed < 0 {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "amount_owed",
				Message: "Amount owed cannot be negative",
				Code:    "invalid_range",
			})
		} else if amountOwed > currentValue {
			result.Valid = false
			result.Errors = append(result.Errors, ValidationError{
				Field:   "amount_owed",
				Message: "Amount owed cannot exceed current value",
				Code:    "invalid_range",
			})
		}
	}

	// Validate optional purchase date
	if _, err := p.validateDateField(data, "purchase_date", false); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, *err)
	}

	// Validate custom fields based on category schema
	if int(categoryID) > 0 {
		if customFieldErrors := p.validateCustomFields(data, int(categoryID)); len(customFieldErrors) > 0 {
			result.Valid = false
			result.Errors = append(result.Errors, customFieldErrors...)
		}
	}

	result.Data = data
	return result
}

// transformCustomFields converts flattened custom field names to nested structure
func (p *OtherAssetsPlugin) transformCustomFields(data map[string]interface{}) {
	customFields := make(map[string]interface{})
	
	// Find and move flattened custom fields to nested structure
	for key, value := range data {
		if strings.HasPrefix(key, "custom_fields.") {
			fieldName := strings.TrimPrefix(key, "custom_fields.")
			customFields[fieldName] = value
			delete(data, key)
		}
	}
	
	// Merge with existing custom_fields if any
	if existingCustomFields, exists := data["custom_fields"].(map[string]interface{}); exists {
		for key, value := range existingCustomFields {
			customFields[key] = value
		}
	}
	
	// Set the custom_fields object
	if len(customFields) > 0 {
		data["custom_fields"] = customFields
	}
}

// validateCustomFields validates custom fields based on category schema
func (p *OtherAssetsPlugin) validateCustomFields(data map[string]interface{}, categoryID int) []ValidationError {
	var errors []ValidationError

	// Transform flattened custom fields to nested structure first
	p.transformCustomFields(data)

	// Get category schema
	var schemaJSON sql.NullString
	query := "SELECT custom_schema FROM asset_categories WHERE id = $1"
	err := p.db.QueryRow(query, categoryID).Scan(&schemaJSON)
	if err != nil || !schemaJSON.Valid {
		return errors
	}

	// Parse schema
	var schema struct {
		Fields []FieldSpec `json:"fields"`
	}
	if err := json.Unmarshal([]byte(schemaJSON.String), &schema); err != nil {
		return errors
	}

	// Create custom_fields map if it doesn't exist
	customFields, exists := data["custom_fields"].(map[string]interface{})
	if !exists {
		customFields = make(map[string]interface{})
		data["custom_fields"] = customFields
	}

	// Validate each custom field
	for _, field := range schema.Fields {
		value, exists := customFields[field.Name]
		
		// Check required fields
		if field.Required && (!exists || value == nil || value == "") {
			errors = append(errors, ValidationError{
				Field:   fmt.Sprintf("custom_fields.%s", field.Name),
				Message: fmt.Sprintf("%s is required", field.Label),
				Code:    "required",
			})
			continue
		}

		// Skip validation if field is not provided and not required
		if !exists || value == nil {
			continue
		}

		// Validate based on field type
		switch field.Type {
		case "number":
			if valueStr, ok := value.(string); ok && valueStr != "" {
				if floatVal, err := strconv.ParseFloat(valueStr, 64); err != nil {
					errors = append(errors, ValidationError{
						Field:   fmt.Sprintf("custom_fields.%s", field.Name),
						Message: fmt.Sprintf("%s must be a valid number", field.Label),
						Code:    "invalid_number",
					})
				} else {
					customFields[field.Name] = floatVal
					// Apply numeric validation
					if field.Validation.Min != nil && floatVal < *field.Validation.Min {
						errors = append(errors, ValidationError{
							Field:   fmt.Sprintf("custom_fields.%s", field.Name),
							Message: fmt.Sprintf("%s must be at least %v", field.Label, *field.Validation.Min),
							Code:    "min_value",
						})
					}
					if field.Validation.Max != nil && floatVal > *field.Validation.Max {
						errors = append(errors, ValidationError{
							Field:   fmt.Sprintf("custom_fields.%s", field.Name),
							Message: fmt.Sprintf("%s must be at most %v", field.Label, *field.Validation.Max),
							Code:    "max_value",
						})
					}
				}
			}
		case "text", "textarea":
			if valueStr, ok := value.(string); ok {
				valueStr = strings.TrimSpace(valueStr)
				customFields[field.Name] = valueStr
				// Apply string validation
				if field.Validation.MaxLength != nil && len(valueStr) > *field.Validation.MaxLength {
					errors = append(errors, ValidationError{
						Field:   fmt.Sprintf("custom_fields.%s", field.Name),
						Message: fmt.Sprintf("%s must be %d characters or less", field.Label, *field.Validation.MaxLength),
						Code:    "max_length",
					})
				}
			}
		case "select":
			// Validate that value is in options
			if valueStr, ok := value.(string); ok && len(field.Options) > 0 {
				validOption := false
				for _, option := range field.Options {
					if option.Value == valueStr {
						validOption = true
						break
					}
				}
				if !validOption {
					errors = append(errors, ValidationError{
						Field:   fmt.Sprintf("custom_fields.%s", field.Name),
						Message: fmt.Sprintf("%s has an invalid value", field.Label),
						Code:    "invalid_option",
					})
				}
			}
		}
	}

	return errors
}

// ProcessManualEntry processes the manual entry data
func (p *OtherAssetsPlugin) ProcessManualEntry(data map[string]interface{}) error {
	categoryID := data["asset_category_id"].(float64)
	assetName := data["asset_name"].(string)
	currentValue := data["current_value"].(float64)

	var purchasePrice, amountOwed *float64
	if pp, exists := data["purchase_price"]; exists && pp != nil {
		val := pp.(float64)
		purchasePrice = &val
	}
	if ao, exists := data["amount_owed"]; exists && ao != nil {
		val := ao.(float64)
		amountOwed = &val
	}

	var purchaseDate *time.Time
	if pd, exists := data["purchase_date"]; exists && pd != nil {
		if dateStr, ok := pd.(string); ok && dateStr != "" {
			if date, err := time.Parse("2006-01-02", dateStr); err == nil {
				purchaseDate = &date
			}
		}
	}

	var description string
	if d, exists := data["description"]; exists && d != nil {
		description = d.(string)
	}

	// Handle custom fields
	var customFieldsJSON []byte
	if customFields, exists := data["custom_fields"]; exists && customFields != nil {
		if cfMap, ok := customFields.(map[string]interface{}); ok && len(cfMap) > 0 {
			if jsonData, err := json.Marshal(cfMap); err == nil {
				customFieldsJSON = jsonData
			}
		}
	}

	// Create unique account for this asset
	uniqueIdentifier := fmt.Sprintf("%s_%d", strings.ReplaceAll(assetName, " ", "_"), time.Now().Unix())
	uniqueAccountID, err := GetOrCreateUniquePluginAccount(
		p.db,
		"Other Assets",
		uniqueIdentifier,
		"other_assets",
		"Manual Entry",
		"manual",
	)
	if err != nil {
		return fmt.Errorf("failed to create unique account for other asset: %w", err)
	}

	// Insert other asset
	query := `
		INSERT INTO miscellaneous_assets (
			account_id, asset_category_id, asset_name, current_value, 
			purchase_price, amount_owed, purchase_date, description, 
			custom_fields, valuation_method, created_at, last_updated
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	now := time.Now()
	_, err = p.db.Exec(query,
		uniqueAccountID, int(categoryID), assetName, currentValue,
		purchasePrice, amountOwed, purchaseDate, description,
		customFieldsJSON, "manual", now, now,
	)

	if err != nil {
		return fmt.Errorf("failed to save other asset: %w", err)
	}

	p.lastUpdated = now
	return nil
}

// UpdateManualEntry updates an existing manual entry
func (p *OtherAssetsPlugin) UpdateManualEntry(id int, data map[string]interface{}) error {
	// Validate the data first
	validation := p.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	categoryID := data["asset_category_id"].(float64)
	assetName := data["asset_name"].(string)
	currentValue := data["current_value"].(float64)

	var purchasePrice, amountOwed *float64
	if pp, exists := data["purchase_price"]; exists && pp != nil {
		val := pp.(float64)
		purchasePrice = &val
	}
	if ao, exists := data["amount_owed"]; exists && ao != nil {
		val := ao.(float64)
		amountOwed = &val
	}

	var purchaseDate *time.Time
	if pd, exists := data["purchase_date"]; exists && pd != nil {
		if dateStr, ok := pd.(string); ok && dateStr != "" {
			if date, err := time.Parse("2006-01-02", dateStr); err == nil {
				purchaseDate = &date
			}
		}
	}

	var description string
	if d, exists := data["description"]; exists && d != nil {
		description = d.(string)
	}

	// Handle custom fields
	var customFieldsJSON []byte
	if customFields, exists := data["custom_fields"]; exists && customFields != nil {
		if cfMap, ok := customFields.(map[string]interface{}); ok && len(cfMap) > 0 {
			if jsonData, err := json.Marshal(cfMap); err == nil {
				customFieldsJSON = jsonData
			}
		}
	}

	// Update other asset
	query := `
		UPDATE miscellaneous_assets 
		SET asset_category_id = $1, asset_name = $2, current_value = $3, 
		    purchase_price = $4, amount_owed = $5, purchase_date = $6, 
		    description = $7, custom_fields = $8, last_updated = $9
		WHERE id = $10
	`

	result, err := p.db.Exec(query,
		int(categoryID), assetName, currentValue,
		purchasePrice, amountOwed, purchaseDate, description,
		customFieldsJSON, time.Now(), id,
	)

	if err != nil {
		return fmt.Errorf("failed to update other asset: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check update result: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("other asset not found")
	}

	p.lastUpdated = time.Now()
	return nil
}

// RefreshData refreshes data for this plugin
func (p *OtherAssetsPlugin) RefreshData() error {
	// Could potentially update asset values from external APIs
	p.lastUpdated = time.Now()
	return nil
}

// GetLastUpdate returns the last update time
func (p *OtherAssetsPlugin) GetLastUpdate() time.Time {
	return p.lastUpdated
}

// Helper methods for validation
func (p *OtherAssetsPlugin) validateNumberField(data map[string]interface{}, field string, required bool) (float64, *ValidationError) {
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

func (p *OtherAssetsPlugin) validateDateField(data map[string]interface{}, field string, required bool) (time.Time, *ValidationError) {
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

	if value == nil {
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

	if dateStr == "" {
		if required {
			return time.Time{}, &ValidationError{
				Field:   field,
				Message: fmt.Sprintf("%s is required", field),
				Code:    "required",
			}
		}
		return time.Time{}, nil
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