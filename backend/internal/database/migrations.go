package database

const (
	createCredentialsTable = `
		CREATE TABLE IF NOT EXISTS credentials (
			id SERIAL PRIMARY KEY,
			service_type VARCHAR(50) NOT NULL,
			credential_type VARCHAR(20) NOT NULL,
			name VARCHAR(100) NOT NULL,
			encrypted_data TEXT NOT NULL,
			is_active BOOLEAN DEFAULT true,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_used TIMESTAMP,
			UNIQUE(service_type, is_active) DEFERRABLE INITIALLY DEFERRED
		);
		
		CREATE INDEX IF NOT EXISTS idx_credentials_service_type ON credentials(service_type);
		CREATE INDEX IF NOT EXISTS idx_credentials_active ON credentials(is_active);`

	createDataSourcesTable = `
		CREATE TABLE IF NOT EXISTS data_sources (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL UNIQUE,
			type VARCHAR(50) NOT NULL,
			status VARCHAR(20) DEFAULT 'inactive',
			config_schema JSONB,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createAccountsTable = `
		CREATE TABLE IF NOT EXISTS accounts (
			id SERIAL PRIMARY KEY,
			data_source_id INTEGER REFERENCES data_sources(id),
			external_account_id VARCHAR(100),
			account_name VARCHAR(200) NOT NULL,
			account_type VARCHAR(50) NOT NULL,
			institution VARCHAR(100),
			data_source_type VARCHAR(20) DEFAULT 'api',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createAccountBalancesTable = `
		CREATE TABLE IF NOT EXISTS account_balances (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			balance DECIMAL(15,2) NOT NULL,
			currency VARCHAR(3) DEFAULT 'USD',
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			data_source VARCHAR(20) DEFAULT 'api'
		);`

	createManualEntriesTable = `
		CREATE TABLE IF NOT EXISTS manual_entries (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			entry_type VARCHAR(50) NOT NULL,
			data_json JSONB NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createManualEntryLogTable = `
		CREATE TABLE IF NOT EXISTS manual_entry_log (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			entry_type VARCHAR(50),
			field_changed VARCHAR(100),
			old_value TEXT,
			new_value TEXT,
			updated_by VARCHAR(100) DEFAULT 'user',
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createStockHoldingsTable = `
		CREATE TABLE IF NOT EXISTS stock_holdings (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			symbol VARCHAR(10) NOT NULL,
			company_name VARCHAR(200),
			shares_owned DECIMAL(15,6) NOT NULL,
			cost_basis DECIMAL(10,4),
			current_price DECIMAL(10,4),
			market_value DECIMAL(15,2) GENERATED ALWAYS AS (shares_owned * COALESCE(current_price, 0)) STORED,
			data_source VARCHAR(20) DEFAULT 'manual',
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(account_id, symbol)
		);`

	createStockPricesTable = `
		CREATE TABLE IF NOT EXISTS stock_prices (
			id SERIAL PRIMARY KEY,
			symbol VARCHAR(10) NOT NULL,
			price DECIMAL(10,4) NOT NULL,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			source VARCHAR(50) DEFAULT 'api',
			UNIQUE(symbol, timestamp)
		);`

	createEquityGrantsTable = `
		CREATE TABLE IF NOT EXISTS equity_grants (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			grant_type VARCHAR(50) NOT NULL,
			company_symbol VARCHAR(10) NOT NULL,
			total_shares DECIMAL(15,6) NOT NULL,
			vested_shares DECIMAL(15,6) DEFAULT 0,
			unvested_shares DECIMAL(15,6) NOT NULL,
			strike_price DECIMAL(10,4),
			current_price DECIMAL(10,4) DEFAULT 0,
			grant_date DATE NOT NULL,
			vest_start_date DATE NOT NULL,
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(account_id, grant_type, company_symbol, grant_date)
		);`

	createVestingScheduleTable = `
		CREATE TABLE IF NOT EXISTS vesting_schedule (
			id SERIAL PRIMARY KEY,
			grant_id INTEGER REFERENCES equity_grants(id),
			vest_date DATE NOT NULL,
			shares_vesting INTEGER NOT NULL,
			cumulative_vested INTEGER NOT NULL,
			is_future_vest BOOLEAN DEFAULT TRUE,
			data_source VARCHAR(20) DEFAULT 'manual',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createRealEstatePropertiesTable = `
		CREATE TABLE IF NOT EXISTS real_estate_properties (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			property_type VARCHAR(50) NOT NULL,
			property_name VARCHAR(200) NOT NULL,
			purchase_price DECIMAL(15,2) NOT NULL,
			current_value DECIMAL(15,2) NOT NULL,
			outstanding_mortgage DECIMAL(15,2) DEFAULT 0,
			equity DECIMAL(15,2) NOT NULL,
			purchase_date DATE NOT NULL,
			property_size_sqft DECIMAL(10,2),
			lot_size_acres DECIMAL(8,4),
			rental_income_monthly DECIMAL(10,2),
			property_tax_annual DECIMAL(10,2),
			notes TEXT,
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(account_id, property_name)
		);`

	createMiscellaneousAssetsTable = `
		CREATE TABLE IF NOT EXISTS miscellaneous_assets (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			asset_name VARCHAR(200) NOT NULL,
			asset_type VARCHAR(50),
			current_value DECIMAL(15,2) NOT NULL,
			description TEXT,
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createNetWorthSnapshotsTable = `
		CREATE TABLE IF NOT EXISTS net_worth_snapshots (
			id SERIAL PRIMARY KEY,
			total_assets DECIMAL(15,2) NOT NULL,
			total_liabilities DECIMAL(15,2) NOT NULL,
			net_worth DECIMAL(15,2) NOT NULL,
			vested_equity_value DECIMAL(15,2),
			unvested_equity_value DECIMAL(15,2),
			stock_holdings_value DECIMAL(15,2),
			real_estate_equity DECIMAL(15,2),
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createIndices = `
		CREATE INDEX IF NOT EXISTS idx_accounts_data_source ON accounts(data_source_id);
		CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
		CREATE INDEX IF NOT EXISTS idx_account_balances_timestamp ON account_balances(timestamp);
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_symbol ON stock_holdings(symbol);
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_account ON stock_holdings(account_id);
		CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices(symbol);
		CREATE INDEX IF NOT EXISTS idx_equity_grants_account ON equity_grants(account_id);
		CREATE INDEX IF NOT EXISTS idx_equity_grants_symbol ON equity_grants(company_symbol);
		CREATE INDEX IF NOT EXISTS idx_vesting_schedule_grant ON vesting_schedule(grant_id);
		CREATE INDEX IF NOT EXISTS idx_vesting_schedule_date ON vesting_schedule(vest_date);
		CREATE INDEX IF NOT EXISTS idx_real_estate_account ON real_estate_properties(account_id);
		CREATE INDEX IF NOT EXISTS idx_real_estate_type ON real_estate_properties(property_type);
		CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_timestamp ON net_worth_snapshots(timestamp);
	`
)