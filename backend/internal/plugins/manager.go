package plugins

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	"networth-dashboard/internal/models"
)

// Plugin manager handles all registered plugins
type Manager struct {
	plugins     map[string]FinancialDataPlugin
	dataCache   map[string]CachedData
	db          *sql.DB
	mu          sync.RWMutex
	cacheMu     sync.RWMutex
}

type CachedData struct {
	Data      interface{} `json:"data"`
	Timestamp time.Time   `json:"timestamp"`
	TTL       time.Duration `json:"ttl"`
}

type AggregatedData struct {
	Accounts    []models.Account        `json:"accounts"`
	Balances    []models.AccountBalance `json:"balances"`
	NetWorth    models.NetWorthSummary  `json:"net_worth"`
	LastUpdated time.Time               `json:"last_updated"`
}

// NewManager creates a new plugin manager
func NewManager(db *sql.DB) *Manager {
	return &Manager{
		plugins:   make(map[string]FinancialDataPlugin),
		dataCache: make(map[string]CachedData),
		db:        db,
	}
}

// RegisterPlugin registers a new plugin
func (m *Manager) RegisterPlugin(plugin FinancialDataPlugin) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	name := plugin.GetName()
	if _, exists := m.plugins[name]; exists {
		return fmt.Errorf("plugin %s already registered", name)
	}

	m.plugins[name] = plugin
	return nil
}

// UnregisterPlugin removes a plugin
func (m *Manager) UnregisterPlugin(pluginName string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	plugin, exists := m.plugins[pluginName]
	if !exists {
		return fmt.Errorf("plugin %s not found", pluginName)
	}

	// Disconnect the plugin
	if err := plugin.Disconnect(); err != nil {
		return fmt.Errorf("failed to disconnect plugin %s: %w", pluginName, err)
	}

	delete(m.plugins, pluginName)
	
	// Clear cache for this plugin
	m.invalidateCache(pluginName)
	
	return nil
}

// GetPlugin returns a specific plugin
func (m *Manager) GetPlugin(pluginName string) (FinancialDataPlugin, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugin, exists := m.plugins[pluginName]
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", pluginName)
	}

	return plugin, nil
}

// ListPlugins returns all registered plugins
func (m *Manager) ListPlugins() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	names := make([]string, 0, len(m.plugins))
	for name := range m.plugins {
		names = append(names, name)
	}
	return names
}

// FetchAllData aggregates data from all plugins
func (m *Manager) FetchAllData() (*AggregatedData, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var allAccounts []models.Account
	var allBalances []models.AccountBalance

	for name, plugin := range m.plugins {
		// Check cache first
		if cachedData := m.getCachedData(name); cachedData != nil {
			if data, ok := cachedData.Data.(*AggregatedData); ok {
				allAccounts = append(allAccounts, data.Accounts...)
				allBalances = append(allBalances, data.Balances...)
				continue
			}
		}

		// Fetch fresh data
		accounts, err := plugin.GetAccounts()
		if err != nil {
			// Log error but continue with other plugins
			continue
		}

		balances, err := plugin.GetBalances()
		if err != nil {
			// Log error but continue with other plugins
			continue
		}

		allAccounts = append(allAccounts, accounts...)
		allBalances = append(allBalances, balances...)

		// Cache the data
		pluginData := &AggregatedData{
			Accounts:    accounts,
			Balances:    balances,
			LastUpdated: time.Now(),
		}
		m.setCachedData(name, pluginData, 15*time.Minute) // 15 minute TTL
	}

	// Calculate net worth
	netWorth := m.calculateNetWorth(allBalances)

	return &AggregatedData{
		Accounts:    allAccounts,
		Balances:    allBalances,
		NetWorth:    netWorth,
		LastUpdated: time.Now(),
	}, nil
}

// RefreshData refreshes data for specific plugins or all plugins
func (m *Manager) RefreshData(pluginNames ...string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(pluginNames) == 0 {
		// Refresh all plugins
		for name := range m.plugins {
			pluginNames = append(pluginNames, name)
		}
	}

	for _, name := range pluginNames {
		plugin, exists := m.plugins[name]
		if !exists {
			continue
		}

		// Invalidate cache to force fresh fetch
		m.invalidateCache(name)

		// Fetch fresh data
		accounts, err := plugin.GetAccounts()
		if err != nil {
			return fmt.Errorf("failed to refresh data for plugin %s: %w", name, err)
		}

		balances, err := plugin.GetBalances()
		if err != nil {
			return fmt.Errorf("failed to refresh balances for plugin %s: %w", name, err)
		}

		// Cache the fresh data
		pluginData := &AggregatedData{
			Accounts:    accounts,
			Balances:    balances,
			LastUpdated: time.Now(),
		}
		m.setCachedData(name, pluginData, 15*time.Minute)
	}

	return nil
}

// Cache management methods
func (m *Manager) getCachedData(pluginName string) *CachedData {
	m.cacheMu.RLock()
	defer m.cacheMu.RUnlock()

	cached, exists := m.dataCache[pluginName]
	if !exists {
		return nil
	}

	// Check if cache is still valid
	if time.Since(cached.Timestamp) > cached.TTL {
		return nil
	}

	return &cached
}

func (m *Manager) setCachedData(pluginName string, data interface{}, ttl time.Duration) {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	m.dataCache[pluginName] = CachedData{
		Data:      data,
		Timestamp: time.Now(),
		TTL:       ttl,
	}
}

func (m *Manager) invalidateCache(pluginName string) {
	m.cacheMu.Lock()
	defer m.cacheMu.Unlock()

	if pluginName == "" {
		// Clear all cache
		m.dataCache = make(map[string]CachedData)
	} else {
		delete(m.dataCache, pluginName)
	}
}

// calculateNetWorth calculates net worth from all balances
func (m *Manager) calculateNetWorth(balances []models.AccountBalance) models.NetWorthSummary {
	var totalAssets, totalLiabilities float64

	for _, balance := range balances {
		if balance.Balance >= 0 {
			totalAssets += balance.Balance
		} else {
			totalLiabilities += -balance.Balance
		}
	}

	return models.NetWorthSummary{
		NetWorth:         totalAssets - totalLiabilities,
		TotalAssets:      totalAssets,
		TotalLiabilities: totalLiabilities,
		LastUpdated:      time.Now(),
	}
}

// GetManualEntryPlugins returns all plugins that support manual entry
func (m *Manager) GetManualEntryPlugins() map[string]ManualEntrySchema {
	m.mu.RLock()
	defer m.mu.RUnlock()

	schemas := make(map[string]ManualEntrySchema)
	for name, plugin := range m.plugins {
		if plugin.SupportsManualEntry() {
			schemas[name] = plugin.GetManualEntrySchema()
		}
	}
	return schemas
}

// ProcessManualEntry processes manual entry data through the appropriate plugin
func (m *Manager) ProcessManualEntry(pluginName string, data interface{}) error {
	plugin, err := m.GetPlugin(pluginName)
	if err != nil {
		return err
	}

	if !plugin.SupportsManualEntry() {
		return fmt.Errorf("plugin %s does not support manual entry", pluginName)
	}

	// Validate the data
	validation := plugin.ValidateManualEntry(data)
	if !validation.Valid {
		return fmt.Errorf("validation failed: %v", validation.Errors)
	}

	// Process the entry
	return plugin.ProcessManualEntry(data)
}

// HealthCheck performs health checks on all plugins
func (m *Manager) HealthCheck() map[string]error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	results := make(map[string]error)
	for name, plugin := range m.plugins {
		results[name] = plugin.HealthCheck()
	}
	return results
}