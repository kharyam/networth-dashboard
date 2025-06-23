package plugins

import (
	"time"
	"networth-dashboard/internal/models"
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

// Plugin configuration
type PluginConfig struct {
	Name            string                 `json:"name"`
	Type            PluginType             `json:"type"`
	Enabled         bool                   `json:"enabled"`
	CredentialType  string                 `json:"credential_type"`
	EndpointConfig  map[string]string      `json:"endpoints"`
	RefreshInterval time.Duration          `json:"refresh_interval"`
	RateLimit       RateLimitConfig        `json:"rate_limit"`
	CustomSettings  map[string]interface{} `json:"custom_settings"`
}

type RateLimitConfig struct {
	RequestsPerSecond int           `json:"requests_per_second"`
	BurstSize         int           `json:"burst_size"`
	Timeout           time.Duration `json:"timeout"`
}

// Manual entry schema
type ManualEntrySchema struct {
	Fields          []ManualEntryField `json:"fields"`
	ValidationRules []ValidationRule   `json:"validation_rules"`
	UpdateFrequency string             `json:"update_frequency"`
}

type ManualEntryField struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Label       string                 `json:"label"`
	Required    bool                   `json:"required"`
	Placeholder string                 `json:"placeholder,omitempty"`
	Options     []string               `json:"options,omitempty"`
	Validation  map[string]interface{} `json:"validation,omitempty"`
}

type ValidationRule struct {
	Field   string `json:"field"`
	Rule    string `json:"rule"`
	Message string `json:"message"`
}

type ValidationResult struct {
	Valid  bool              `json:"valid"`
	Errors map[string]string `json:"errors,omitempty"`
}

// Date range for queries
type DateRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// Core plugin interface
type FinancialDataPlugin interface {
	// Plugin metadata
	GetName() string
	GetType() PluginType
	GetDataSource() DataSourceType
	
	// Plugin lifecycle
	Initialize(config PluginConfig) error
	Authenticate() error
	Disconnect() error
	
	// Data fetching (for API plugins)
	GetAccounts() ([]models.Account, error)
	GetBalances() ([]models.AccountBalance, error)
	GetTransactions(dateRange DateRange) ([]models.Transaction, error)
	
	// Manual entry support
	SupportsManualEntry() bool
	GetManualEntrySchema() ManualEntrySchema
	ValidateManualEntry(data interface{}) ValidationResult
	ProcessManualEntry(data interface{}) error
	
	// Configuration
	GetConfig() PluginConfig
	ValidateConfig(config PluginConfig) bool
	
	// Health check
	HealthCheck() error
}

// Base plugin implementation
type BasePlugin struct {
	name       string
	pluginType PluginType
	dataSource DataSourceType
	config     PluginConfig
}

func NewBasePlugin(name string, pluginType PluginType, dataSource DataSourceType) *BasePlugin {
	return &BasePlugin{
		name:       name,
		pluginType: pluginType,
		dataSource: dataSource,
	}
}

func (bp *BasePlugin) GetName() string {
	return bp.name
}

func (bp *BasePlugin) GetType() PluginType {
	return bp.pluginType
}

func (bp *BasePlugin) GetDataSource() DataSourceType {
	return bp.dataSource
}

func (bp *BasePlugin) Initialize(config PluginConfig) error {
	bp.config = config
	return nil
}

func (bp *BasePlugin) GetConfig() PluginConfig {
	return bp.config
}

func (bp *BasePlugin) ValidateConfig(config PluginConfig) bool {
	return config.Name != "" && config.Type != ""
}

// Default implementations that can be overridden
func (bp *BasePlugin) Authenticate() error {
	return nil
}

func (bp *BasePlugin) Disconnect() error {
	return nil
}

func (bp *BasePlugin) GetAccounts() ([]models.Account, error) {
	return []models.Account{}, nil
}

func (bp *BasePlugin) GetBalances() ([]models.AccountBalance, error) {
	return []models.AccountBalance{}, nil
}

func (bp *BasePlugin) GetTransactions(dateRange DateRange) ([]models.Transaction, error) {
	return []models.Transaction{}, nil
}

func (bp *BasePlugin) SupportsManualEntry() bool {
	return false
}

func (bp *BasePlugin) GetManualEntrySchema() ManualEntrySchema {
	return ManualEntrySchema{}
}

func (bp *BasePlugin) ValidateManualEntry(data interface{}) ValidationResult {
	return ValidationResult{Valid: true}
}

func (bp *BasePlugin) ProcessManualEntry(data interface{}) error {
	return nil
}

func (bp *BasePlugin) HealthCheck() error {
	return nil
}