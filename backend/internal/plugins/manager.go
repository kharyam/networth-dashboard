package plugins

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// Manager handles plugin operations and data aggregation
type Manager struct {
	db       *sql.DB
	registry *Registry
}

// NewManager creates a new plugin manager
func NewManager(db *sql.DB) *Manager {
	manager := &Manager{
		db:       db,
		registry: NewRegistry(),
	}

	// Register built-in plugins
	manager.registerBuiltinPlugins()

	return manager
}

// registerBuiltinPlugins registers the built-in plugins
func (m *Manager) registerBuiltinPlugins() {
	// Register Stock Holding plugin
	stockHoldingPlugin := NewStockHoldingPlugin(m.db)
	if err := m.registry.Register(stockHoldingPlugin); err != nil {
		fmt.Printf("Failed to register Stock Holding plugin: %v\n", err)
	}

	// Register Morgan Stanley plugin
	morganStanleyPlugin := NewMorganStanleyPlugin(m.db)
	if err := m.registry.Register(morganStanleyPlugin); err != nil {
		fmt.Printf("Failed to register Morgan Stanley plugin: %v\n", err)
	}

	// Register Real Estate plugin
	realEstatePlugin := NewRealEstatePlugin(m.db)
	if err := m.registry.Register(realEstatePlugin); err != nil {
		fmt.Printf("Failed to register Real Estate plugin: %v\n", err)
	}

	// Register Cash Holdings plugin
	cashHoldingsPlugin := NewCashHoldingsPlugin(m.db)
	if err := m.registry.Register(cashHoldingsPlugin); err != nil {
		fmt.Printf("Failed to register Cash Holdings plugin: %v\n", err)
	}

	// Register Crypto Holdings plugin
	cryptoHoldingsPlugin := NewCryptoHoldingsPlugin(m.db)
	if err := m.registry.Register(cryptoHoldingsPlugin); err != nil {
		fmt.Printf("Failed to register Crypto Holdings plugin: %v\n", err)
	}

	// Initialize with default configurations
	m.initializeDefaultConfigs()
}

// initializeDefaultConfigs sets up default configurations for plugins
func (m *Manager) initializeDefaultConfigs() {
	defaultConfig := PluginConfig{
		Enabled:  true,
		Settings: make(map[string]interface{}),
	}

	plugins := []string{"stock_holding", "morgan_stanley", "real_estate", "cash_holdings", "crypto_holdings"}
	for _, pluginName := range plugins {
		if err := m.registry.Configure(pluginName, defaultConfig); err != nil {
			fmt.Printf("Failed to configure plugin %s: %v\n", pluginName, err)
		}
	}
}

// ListPlugins returns all registered plugins
func (m *Manager) ListPlugins() []PluginInfo {
	return m.registry.List()
}

// GetPlugin retrieves a specific plugin
func (m *Manager) GetPlugin(name string) (FinancialDataPlugin, error) {
	return m.registry.Get(name)
}

// EnablePlugin activates a plugin
func (m *Manager) EnablePlugin(name string) error {
	return m.registry.Enable(name)
}

// DisablePlugin deactivates a plugin
func (m *Manager) DisablePlugin(name string) error {
	return m.registry.Disable(name)
}

// ConfigurePlugin sets configuration for a plugin
func (m *Manager) ConfigurePlugin(name string, config PluginConfig) error {
	return m.registry.Configure(name, config)
}

// GetPluginConfig retrieves configuration for a plugin
func (m *Manager) GetPluginConfig(name string) (PluginConfig, error) {
	return m.registry.GetConfig(name)
}

// GetManualEntrySchema retrieves the manual entry schema for a plugin
func (m *Manager) GetManualEntrySchema(name string) (ManualEntrySchema, error) {
	plugin, err := m.registry.Get(name)
	if err != nil {
		return ManualEntrySchema{}, err
	}

	if !plugin.SupportsManualEntry() {
		return ManualEntrySchema{}, fmt.Errorf("plugin %s does not support manual entry", name)
	}

	return plugin.GetManualEntrySchema(), nil
}

// ProcessManualEntry processes manual data entry through a plugin
func (m *Manager) ProcessManualEntry(pluginName string, data map[string]interface{}) error {
	plugin, err := m.registry.Get(pluginName)
	if err != nil {
		return err
	}

	if !plugin.SupportsManualEntry() {
		return fmt.Errorf("plugin %s does not support manual entry", pluginName)
	}

	// Validate the data first
	validation := plugin.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// Process the entry
	return plugin.ProcessManualEntry(data)
}

// ValidateManualEntry validates manual entry data
func (m *Manager) ValidateManualEntry(pluginName string, data map[string]interface{}) (ValidationResult, error) {
	plugin, err := m.registry.Get(pluginName)
	if err != nil {
		return ValidationResult{}, err
	}

	if !plugin.SupportsManualEntry() {
		return ValidationResult{}, fmt.Errorf("plugin %s does not support manual entry", pluginName)
	}

	return plugin.ValidateManualEntry(data), nil
}

// GetAllAccounts aggregates accounts from all active plugins
func (m *Manager) GetAllAccounts() ([]Account, error) {
	var allAccounts []Account
	
	activePlugins := m.registry.GetActivePlugins()
	for _, plugin := range activePlugins {
		accounts, err := plugin.GetAccounts()
		if err != nil {
			// Log error but continue with other plugins
			fmt.Printf("Error getting accounts from plugin %s: %v\n", plugin.GetName(), err)
			continue
		}
		allAccounts = append(allAccounts, accounts...)
	}

	return allAccounts, nil
}

// GetAllBalances aggregates balances from all active plugins
func (m *Manager) GetAllBalances() ([]Balance, error) {
	var allBalances []Balance
	
	activePlugins := m.registry.GetActivePlugins()
	for _, plugin := range activePlugins {
		balances, err := plugin.GetBalances()
		if err != nil {
			// Log error but continue with other plugins
			fmt.Printf("Error getting balances from plugin %s: %v\n", plugin.GetName(), err)
			continue
		}
		allBalances = append(allBalances, balances...)
	}

	return allBalances, nil
}

// GetAllTransactions aggregates transactions from all active plugins
func (m *Manager) GetAllTransactions(dateRange DateRange) ([]Transaction, error) {
	var allTransactions []Transaction
	
	activePlugins := m.registry.GetActivePlugins()
	for _, plugin := range activePlugins {
		transactions, err := plugin.GetTransactions(dateRange)
		if err != nil {
			// Log error but continue with other plugins
			fmt.Printf("Error getting transactions from plugin %s: %v\n", plugin.GetName(), err)
			continue
		}
		allTransactions = append(allTransactions, transactions...)
	}

	return allTransactions, nil
}

// RefreshAllData triggers data refresh on all active plugins
func (m *Manager) RefreshAllData() map[string]error {
	return m.registry.RefreshAll()
}

// GetPluginHealth returns health status for all plugins
func (m *Manager) GetPluginHealth() map[string]PluginHealth {
	return m.registry.HealthCheck()
}

// GetManualEntrySchemas returns schemas for all manual entry plugins
func (m *Manager) GetManualEntrySchemas() map[string]ManualEntrySchema {
	schemas := make(map[string]ManualEntrySchema)
	
	manualPlugins := m.registry.GetManualEntryPlugins()
	for _, plugin := range manualPlugins {
		schemas[plugin.GetName()] = plugin.GetManualEntrySchema()
	}

	return schemas
}

// SavePluginData saves plugin data to the database
func (m *Manager) SavePluginData(pluginName string, dataType string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	query := `
		INSERT INTO manual_entries (account_id, entry_type, data_json, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	now := time.Now()
	_, err = m.db.Exec(query, pluginName, dataType, string(jsonData), now, now)
	if err != nil {
		return fmt.Errorf("failed to save plugin data: %w", err)
	}

	return nil
}