package plugins

import (
	"fmt"
	"sync"
)

// Registry manages all registered plugins
type Registry struct {
	plugins map[string]FinancialDataPlugin
	configs map[string]PluginConfig
	mutex   sync.RWMutex
}

// NewRegistry creates a new plugin registry
func NewRegistry() *Registry {
	return &Registry{
		plugins: make(map[string]FinancialDataPlugin),
		configs: make(map[string]PluginConfig),
	}
}

// Register adds a plugin to the registry
func (r *Registry) Register(plugin FinancialDataPlugin) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	name := plugin.GetName()
	if _, exists := r.plugins[name]; exists {
		return fmt.Errorf("plugin %s is already registered", name)
	}

	r.plugins[name] = plugin
	return nil
}

// Unregister removes a plugin from the registry
func (r *Registry) Unregister(name string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	plugin, exists := r.plugins[name]
	if !exists {
		return fmt.Errorf("plugin %s is not registered", name)
	}

	// Disconnect the plugin before removing
	if err := plugin.Disconnect(); err != nil {
		return fmt.Errorf("failed to disconnect plugin %s: %w", name, err)
	}

	delete(r.plugins, name)
	delete(r.configs, name)
	return nil
}

// Get retrieves a plugin by name
func (r *Registry) Get(name string) (FinancialDataPlugin, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	plugin, exists := r.plugins[name]
	if !exists {
		return nil, fmt.Errorf("plugin %s is not registered", name)
	}

	return plugin, nil
}

// List returns all registered plugins
func (r *Registry) List() []PluginInfo {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var plugins []PluginInfo
	for name, plugin := range r.plugins {
		config := r.configs[name]
		health := plugin.IsHealthy()
		
		// Compute status from enabled state and health
		var status string
		if !config.Enabled {
			status = "disabled"
		} else {
			status = string(health.Status)
		}
		
		plugins = append(plugins, PluginInfo{
			Name:        name,
			Type:        plugin.GetType(),
			DataSource:  plugin.GetDataSource(),
			Version:     plugin.GetVersion(),
			Description: plugin.GetDescription(),
			Enabled:     config.Enabled,
			Status:      status,
			Health:      health,
		})
	}

	return plugins
}

// Configure sets the configuration for a plugin
func (r *Registry) Configure(name string, config PluginConfig) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	plugin, exists := r.plugins[name]
	if !exists {
		return fmt.Errorf("plugin %s is not registered", name)
	}

	// Initialize the plugin with the new configuration
	if err := plugin.Initialize(config); err != nil {
		return fmt.Errorf("failed to initialize plugin %s: %w", name, err)
	}

	r.configs[name] = config
	return nil
}

// GetConfig retrieves the configuration for a plugin
func (r *Registry) GetConfig(name string) (PluginConfig, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	config, exists := r.configs[name]
	if !exists {
		return PluginConfig{}, fmt.Errorf("plugin %s is not configured", name)
	}

	return config, nil
}

// Enable activates a plugin
func (r *Registry) Enable(name string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	plugin, exists := r.plugins[name]
	if !exists {
		return fmt.Errorf("plugin %s is not registered", name)
	}

	config := r.configs[name]
	config.Enabled = true

	if err := plugin.Initialize(config); err != nil {
		return fmt.Errorf("failed to enable plugin %s: %w", name, err)
	}

	r.configs[name] = config
	return nil
}

// Disable deactivates a plugin
func (r *Registry) Disable(name string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	plugin, exists := r.plugins[name]
	if !exists {
		return fmt.Errorf("plugin %s is not registered", name)
	}

	config := r.configs[name]
	config.Enabled = false

	if err := plugin.Disconnect(); err != nil {
		return fmt.Errorf("failed to disable plugin %s: %w", name, err)
	}

	r.configs[name] = config
	return nil
}

// GetActivePlugins returns all enabled plugins
func (r *Registry) GetActivePlugins() []FinancialDataPlugin {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var activePlugins []FinancialDataPlugin
	for name, plugin := range r.plugins {
		config := r.configs[name]
		if config.Enabled {
			activePlugins = append(activePlugins, plugin)
		}
	}

	return activePlugins
}

// GetManualEntryPlugins returns all plugins that support manual entry
func (r *Registry) GetManualEntryPlugins() []FinancialDataPlugin {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var manualPlugins []FinancialDataPlugin
	for name, plugin := range r.plugins {
		config := r.configs[name]
		if config.Enabled && plugin.SupportsManualEntry() {
			manualPlugins = append(manualPlugins, plugin)
		}
	}

	return manualPlugins
}

// HealthCheck performs health checks on all active plugins
func (r *Registry) HealthCheck() map[string]PluginHealth {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	healthStatus := make(map[string]PluginHealth)
	for name, plugin := range r.plugins {
		config := r.configs[name]
		if config.Enabled {
			healthStatus[name] = plugin.IsHealthy()
		}
	}

	return healthStatus
}

// RefreshAll triggers data refresh on all active plugins
func (r *Registry) RefreshAll() map[string]error {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	results := make(map[string]error)
	for name, plugin := range r.plugins {
		config := r.configs[name]
		if config.Enabled {
			if err := plugin.RefreshData(); err != nil {
				results[name] = err
			}
		}
	}

	return results
}

// PluginInfo contains metadata about a registered plugin
type PluginInfo struct {
	Name        string       `json:"name"`
	Type        PluginType   `json:"type"`
	DataSource  DataSourceType `json:"data_source"`
	Version     string       `json:"version"`
	Description string       `json:"description"`
	Enabled     bool         `json:"enabled"`
	Status      string       `json:"status"`
	Health      PluginHealth `json:"health"`
}