package plugins

import (
	"database/sql"
	"fmt"
	"time"
)

// Plugin types
type PluginType string

const (
	PluginTypeAPI      PluginType = "api"
	PluginTypeManual   PluginType = "manual"
	PluginTypeScraping PluginType = "scraping"
	PluginTypePlaid    PluginType = "plaid"
)

// Data source types
type DataSourceType string

const (
	DataSourceAPI      DataSourceType = "api"
	DataSourceManual   DataSourceType = "manual"
	DataSourceScraping DataSourceType = "scraping"
)

// Plugin status
type PluginStatus string

const (
	PluginStatusActive    PluginStatus = "active"
	PluginStatusInactive  PluginStatus = "inactive"
	PluginStatusError     PluginStatus = "error"
	PluginStatusUnhealthy PluginStatus = "unhealthy"
)

// Plugin configuration
type PluginConfig struct {
	Enabled  bool                   `json:"enabled"`
	Settings map[string]interface{} `json:"settings"`
}

// Plugin health status
type PluginHealth struct {
	Status      PluginStatus  `json:"status"`
	LastChecked time.Time     `json:"last_checked"`
	Message     string        `json:"message,omitempty"`
	Metrics     PluginMetrics `json:"metrics"`
}

// Plugin performance metrics
type PluginMetrics struct {
	RequestCount int       `json:"request_count"`
	ErrorCount   int       `json:"error_count"`
	SuccessRate  float64   `json:"success_rate"`
	LastUpdate   time.Time `json:"last_update"`
}

// Date range for queries
type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// Account data structure
type Account struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Institution string    `json:"institution"`
	DataSource  string    `json:"data_source"`
	LastUpdated time.Time `json:"last_updated"`
}

// Balance data structure
type Balance struct {
	AccountID  string    `json:"account_id"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	AsOfDate   time.Time `json:"as_of_date"`
	DataSource string    `json:"data_source"`
}

// Transaction data structure
type Transaction struct {
	ID              string    `json:"id"`
	AccountID       string    `json:"account_id"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	Date            time.Time `json:"date"`
	Description     string    `json:"description"`
	Category        string    `json:"category,omitempty"`
	TransactionType string    `json:"transaction_type"`
	DataSource      string    `json:"data_source"`
}

// Manual entry field specification
type FieldSpec struct {
	Name         string          `json:"name"`
	Type         string          `json:"type"`
	Label        string          `json:"label"`
	Description  string          `json:"description,omitempty"`
	Required     bool            `json:"required"`
	Placeholder  string          `json:"placeholder,omitempty"`
	DefaultValue interface{}     `json:"default_value,omitempty"`
	Options      []FieldOption   `json:"options,omitempty"`
	Validation   FieldValidation `json:"validation,omitempty"`
}

// Field option for select/radio fields
type FieldOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// Field validation rules
type FieldValidation struct {
	Pattern   string   `json:"pattern,omitempty"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	MinLength *int     `json:"min_length,omitempty"`
	MaxLength *int     `json:"max_length,omitempty"`
	Required  bool     `json:"required,omitempty"`
}

// Manual entry schema
type ManualEntrySchema struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Version     string      `json:"version"`
	Fields      []FieldSpec `json:"fields"`
}

// Validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// Validation result
type ValidationResult struct {
	Valid  bool                   `json:"valid"`
	Errors []ValidationError      `json:"errors,omitempty"`
	Data   map[string]interface{} `json:"data,omitempty"`
}

// Core plugin interface
type FinancialDataPlugin interface {
	// Plugin metadata
	GetName() string
	GetFriendlyName() string
	GetType() PluginType
	GetDataSource() DataSourceType
	GetVersion() string
	GetDescription() string

	// Plugin lifecycle
	Initialize(config PluginConfig) error
	Authenticate() error
	Disconnect() error

	// Health and status
	IsHealthy() PluginHealth
	RefreshData() error
	GetLastUpdate() time.Time

	// Data fetching
	GetAccounts() ([]Account, error)
	GetBalances() ([]Balance, error)
	GetTransactions(dateRange DateRange) ([]Transaction, error)

	// Manual entry support
	SupportsManualEntry() bool
	GetManualEntrySchema() ManualEntrySchema
	ValidateManualEntry(data map[string]interface{}) ValidationResult
	ProcessManualEntry(data map[string]interface{}) error
	UpdateManualEntry(id int, data map[string]interface{}) error
}

// Helper function to get or create an account for a plugin
// DEPRECATED: This function is no longer used in the new architecture 
// where each asset table stores institution information directly
func GetOrCreatePluginAccount(db *sql.DB, accountName, accountType, institution, dataSourceType string) (int, error) {
	// This function is deprecated and should not be used
	// In the new architecture, asset tables store institution information directly
	return 0, fmt.Errorf("GetOrCreatePluginAccount is deprecated - accounts table no longer exists")
}

// Helper function to get or create a unique account for each manual entry
// DEPRECATED: This function is no longer used in the new architecture
func GetOrCreateUniquePluginAccount(db *sql.DB, baseAccountName, uniqueIdentifier, accountType, institution, dataSourceType string) (int, error) {
	// This function is deprecated and should not be used
	return 0, fmt.Errorf("GetOrCreateUniquePluginAccount is deprecated - accounts table no longer exists")
}

// Bulk update types
type BulkUpdateItem struct {
	ID   int                    `json:"id"`
	Data map[string]interface{} `json:"data"`
}

type BulkUpdateError struct {
	ID     int                    `json:"id"`
	Error  string                 `json:"error"`
	Fields map[string]interface{} `json:"fields"`
}

type BulkUpdateResult struct {
	SuccessCount int               `json:"success_count"`
	FailureCount int               `json:"failure_count"`
	Errors       []BulkUpdateError `json:"errors"`
}

// Error method to implement the error interface for BulkUpdateResult
func (r *BulkUpdateResult) Error() string {
	return fmt.Sprintf("bulk update completed with %d successes and %d failures", r.SuccessCount, r.FailureCount)
}
