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
			data_source VARCHAR(20) DEFAULT 'manual',
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

	createCashHoldingsTable = `
		CREATE TABLE IF NOT EXISTS cash_holdings (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			institution_name VARCHAR(100) NOT NULL,
			account_name VARCHAR(100) NOT NULL,
			account_type VARCHAR(50) NOT NULL,
			current_balance DECIMAL(15,2) NOT NULL,
			interest_rate DECIMAL(5,2),
			monthly_contribution DECIMAL(10,2),
			account_number_last4 VARCHAR(4),
			currency VARCHAR(3) DEFAULT 'USD',
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(account_id, institution_name, account_name)
		);`

	createAssetCategoriesTable = `
		CREATE TABLE IF NOT EXISTS asset_categories (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL UNIQUE,
			description TEXT,
			icon VARCHAR(50),
			color VARCHAR(7), -- Hex color code
			custom_schema JSONB, -- Schema definition for custom fields
			valuation_api_config JSONB, -- API integration config
			is_active BOOLEAN DEFAULT true,
			sort_order INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`

	createMiscellaneousAssetsTable = `
		CREATE TABLE IF NOT EXISTS miscellaneous_assets (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			asset_category_id INTEGER REFERENCES asset_categories(id),
			asset_name VARCHAR(200) NOT NULL,
			asset_type VARCHAR(50), -- Kept for backward compatibility
			current_value DECIMAL(15,2) NOT NULL,
			purchase_price DECIMAL(15,2),
			amount_owed DECIMAL(15,2) DEFAULT 0,
			purchase_date DATE,
			description TEXT,
			custom_fields JSONB, -- Extensible custom properties
			valuation_method VARCHAR(20) DEFAULT 'manual', -- manual, api, formula
			last_valuation_date TIMESTAMP,
			api_provider VARCHAR(50),
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

	createCryptoHoldingsTable = `
		CREATE TABLE IF NOT EXISTS crypto_holdings (
			id SERIAL PRIMARY KEY,
			account_id INTEGER REFERENCES accounts(id),
			institution_name VARCHAR(100) NOT NULL,
			crypto_symbol VARCHAR(20) NOT NULL,
			balance_tokens DECIMAL(20,8) NOT NULL,
			purchase_price_usd DECIMAL(15,2),
			purchase_date DATE,
			wallet_address VARCHAR(255),
			notes TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(account_id, institution_name, crypto_symbol)
		);`

	createCryptoPricesTable = `
		CREATE TABLE IF NOT EXISTS crypto_prices (
			id SERIAL PRIMARY KEY,
			symbol VARCHAR(20) NOT NULL,
			price_usd DECIMAL(15,8) NOT NULL,
			price_btc DECIMAL(15,8),
			market_cap_usd DECIMAL(20,2),
			volume_24h_usd DECIMAL(20,2),
			price_change_24h DECIMAL(8,4),
			last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			source VARCHAR(50) DEFAULT 'coingecko'
		);`

	// Schema updates for existing installations
	updateEquityGrantsTable = `
		ALTER TABLE equity_grants ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'manual';
	`

	updateRealEstateAddressFields = `
		-- Add new address fields to real_estate_properties table
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS street_address VARCHAR(200);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS city VARCHAR(100);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS state VARCHAR(2);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS api_estimated_value DECIMAL(15,2);
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS api_estimate_date TIMESTAMP;
		ALTER TABLE real_estate_properties ADD COLUMN IF NOT EXISTS api_provider VARCHAR(50);
		
		-- Add index for location-based queries
		CREATE INDEX IF NOT EXISTS idx_real_estate_location ON real_estate_properties(city, state);
		CREATE INDEX IF NOT EXISTS idx_real_estate_zip ON real_estate_properties(zip_code);
		CREATE INDEX IF NOT EXISTS idx_real_estate_coordinates ON real_estate_properties(latitude, longitude);
	`

	// Schema update to add institution_name to stock_holdings
	updateStockHoldingsInstitution = `
		-- Add institution_name field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS institution_name VARCHAR(100);
		
		-- Update existing records only if they have NULL institution_name
		UPDATE stock_holdings SET institution_name = 'Computer Share' 
		WHERE institution_name IS NULL;
		
		-- Update data_source from old 'computershare' to new 'stock_holding'
		UPDATE stock_holdings SET data_source = 'stock_holding'
		WHERE data_source = 'computershare';
		
		-- Make institution_name NOT NULL only if column exists and has no nulls
		DO $$
		BEGIN
		    IF EXISTS (
		        SELECT 1 FROM information_schema.columns 
		        WHERE table_name='stock_holdings' AND column_name='institution_name'
		    ) AND NOT EXISTS (
		        SELECT 1 FROM stock_holdings WHERE institution_name IS NULL
		    ) THEN
		        ALTER TABLE stock_holdings ALTER COLUMN institution_name SET NOT NULL;
		    END IF;
		END $$;
		
		-- Drop the old unique constraint if it exists
		ALTER TABLE stock_holdings DROP CONSTRAINT IF EXISTS stock_holdings_account_id_symbol_key;
		
		-- Add new unique constraint only if it doesn't exist
		DO $$
		BEGIN
		    IF NOT EXISTS (
		        SELECT 1 FROM information_schema.table_constraints 
		        WHERE constraint_name = 'stock_holdings_account_id_symbol_institution_key'
		        AND table_name = 'stock_holdings'
		    ) THEN
		        ALTER TABLE stock_holdings ADD CONSTRAINT stock_holdings_account_id_symbol_institution_key 
		        UNIQUE(account_id, symbol, institution_name);
		    END IF;
		END $$;
	`

	// Schema update for other assets extension
	updateMiscellaneousAssetsTable = `
		-- Add missing columns to miscellaneous_assets table
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS asset_category_id INTEGER REFERENCES asset_categories(id);
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(15,2);
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS amount_owed DECIMAL(15,2) DEFAULT 0;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS purchase_date DATE;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS custom_fields JSONB;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS valuation_method VARCHAR(20) DEFAULT 'manual';
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS last_valuation_date TIMESTAMP;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS api_provider VARCHAR(50);
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS notes TEXT;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
		ALTER TABLE miscellaneous_assets ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
	`

	// Schema update to add dividend tracking to stock holdings
	updateStockHoldingsDividend = `
		-- Add dividend tracking field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS estimated_quarterly_dividend DECIMAL(10,4);
		
		-- Add index for dividend queries
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_dividend ON stock_holdings(estimated_quarterly_dividend) WHERE estimated_quarterly_dividend IS NOT NULL AND estimated_quarterly_dividend > 0;
	`

	// Schema update to add purchase date and DRIP fields to stock holdings
	updateStockHoldingsAdditionalFields = `
		-- Add purchase_date field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS purchase_date DATE;
		
		-- Add drip_enabled field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS drip_enabled VARCHAR(10) DEFAULT 'unknown';
		
		-- Add last_manual_update field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS last_manual_update TIMESTAMP;
		
		-- Add index for purchase date queries
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_purchase_date ON stock_holdings(purchase_date) WHERE purchase_date IS NOT NULL;
	`

	// Schema update to add staking percentage to crypto holdings
	updateCryptoHoldingsStaking = `
		-- Add staking_annual_percentage field to crypto_holdings table
		ALTER TABLE crypto_holdings ADD COLUMN IF NOT EXISTS staking_annual_percentage DECIMAL(5,2) DEFAULT 0;
		
		-- Add index for staking queries where percentage > 0
		CREATE INDEX IF NOT EXISTS idx_crypto_holdings_staking ON crypto_holdings(staking_annual_percentage) WHERE staking_annual_percentage > 0;
	`

	// Schema update to add vested equity source flag to stock holdings
	updateStockHoldingsVestedSource = `
		-- Add is_vested_equity field to stock_holdings table
		ALTER TABLE stock_holdings ADD COLUMN IF NOT EXISTS is_vested_equity BOOLEAN DEFAULT false;
		
		-- Add index for vested equity queries
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_vested ON stock_holdings(is_vested_equity) WHERE is_vested_equity = true;
	`

	createIndices = `
		CREATE INDEX IF NOT EXISTS idx_accounts_data_source ON accounts(data_source_id);
		CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
		CREATE INDEX IF NOT EXISTS idx_account_balances_timestamp ON account_balances(timestamp);
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_symbol ON stock_holdings(symbol);
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_account ON stock_holdings(account_id);
		CREATE INDEX IF NOT EXISTS idx_stock_holdings_institution ON stock_holdings(institution_name);
		CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol ON stock_prices(symbol);
		CREATE INDEX IF NOT EXISTS idx_equity_grants_account ON equity_grants(account_id);
		CREATE INDEX IF NOT EXISTS idx_equity_grants_symbol ON equity_grants(company_symbol);
		CREATE INDEX IF NOT EXISTS idx_vesting_schedule_grant ON vesting_schedule(grant_id);
		CREATE INDEX IF NOT EXISTS idx_vesting_schedule_date ON vesting_schedule(vest_date);
		CREATE INDEX IF NOT EXISTS idx_real_estate_account ON real_estate_properties(account_id);
		CREATE INDEX IF NOT EXISTS idx_real_estate_type ON real_estate_properties(property_type);
		CREATE INDEX IF NOT EXISTS idx_cash_holdings_account ON cash_holdings(account_id);
		CREATE INDEX IF NOT EXISTS idx_cash_holdings_type ON cash_holdings(account_type);
		CREATE INDEX IF NOT EXISTS idx_cash_holdings_institution ON cash_holdings(institution_name);
		CREATE INDEX IF NOT EXISTS idx_crypto_holdings_account ON crypto_holdings(account_id);
		CREATE INDEX IF NOT EXISTS idx_crypto_holdings_symbol ON crypto_holdings(crypto_symbol);
		CREATE INDEX IF NOT EXISTS idx_crypto_holdings_institution ON crypto_holdings(institution_name);
		CREATE INDEX IF NOT EXISTS idx_crypto_prices_symbol ON crypto_prices(symbol);
		CREATE INDEX IF NOT EXISTS idx_crypto_prices_updated ON crypto_prices(last_updated);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_prices_symbol_minute ON crypto_prices (symbol, date_trunc('minute', last_updated));
		CREATE INDEX IF NOT EXISTS idx_net_worth_snapshots_timestamp ON net_worth_snapshots(timestamp);
		CREATE INDEX IF NOT EXISTS idx_asset_categories_active ON asset_categories(is_active);
		CREATE INDEX IF NOT EXISTS idx_asset_categories_sort ON asset_categories(sort_order);
		CREATE INDEX IF NOT EXISTS idx_miscellaneous_assets_account ON miscellaneous_assets(account_id);
		CREATE INDEX IF NOT EXISTS idx_miscellaneous_assets_category ON miscellaneous_assets(asset_category_id);
		CREATE INDEX IF NOT EXISTS idx_miscellaneous_assets_type ON miscellaneous_assets(asset_type);
		CREATE INDEX IF NOT EXISTS idx_miscellaneous_assets_valuation ON miscellaneous_assets(valuation_method);
	`

	// Seed data for default asset categories
	seedAssetCategories = `
		INSERT INTO asset_categories (name, description, icon, color, custom_schema, sort_order) VALUES
		('Vehicles', 'Cars, motorcycles, boats, and other vehicles', 'car', '#3B82F6', 
		 '{"fields": [
		   {"name": "make", "type": "text", "label": "Make", "required": true},
		   {"name": "model", "type": "text", "label": "Model", "required": true},
		   {"name": "year", "type": "number", "label": "Year", "required": true, "validation": {"min": 1900, "max": 2030}},
		   {"name": "mileage", "type": "number", "label": "Mileage", "required": false, "validation": {"min": 0}},
		   {"name": "condition", "type": "select", "label": "Condition", "required": false, "options": [
		     {"value": "excellent", "label": "Excellent"},
		     {"value": "good", "label": "Good"},
		     {"value": "fair", "label": "Fair"},
		     {"value": "poor", "label": "Poor"}
		   ]},
		   {"name": "vin", "type": "text", "label": "VIN", "required": false}
		 ]}', 1),
		
		('Jewelry & Collectibles', 'Jewelry, watches, coins, and collectible items', 'gem', '#8B5CF6', 
		 '{"fields": [
		   {"name": "type", "type": "select", "label": "Type", "required": true, "options": [
		     {"value": "jewelry", "label": "Jewelry"},
		     {"value": "watch", "label": "Watch"},
		     {"value": "coin", "label": "Coin"},
		     {"value": "stamp", "label": "Stamp"},
		     {"value": "other", "label": "Other"}
		   ]},
		   {"name": "material", "type": "text", "label": "Material", "required": false},
		   {"name": "appraised_value", "type": "number", "label": "Appraised Value", "required": false},
		   {"name": "certificate_number", "type": "text", "label": "Certificate Number", "required": false},
		   {"name": "appraisal_date", "type": "date", "label": "Appraisal Date", "required": false}
		 ]}', 2),
		
		('Art & Antiques', 'Paintings, sculptures, and antique items', 'palette', '#EF4444', 
		 '{"fields": [
		   {"name": "artist", "type": "text", "label": "Artist", "required": false},
		   {"name": "medium", "type": "text", "label": "Medium", "required": false},
		   {"name": "dimensions", "type": "text", "label": "Dimensions", "required": false},
		   {"name": "provenance", "type": "textarea", "label": "Provenance", "required": false},
		   {"name": "insurance_value", "type": "number", "label": "Insurance Value", "required": false},
		   {"name": "year_created", "type": "number", "label": "Year Created", "required": false}
		 ]}', 3),
		
		('Business Interests', 'Business ownership, partnerships, and investments', 'briefcase', '#10B981', 
		 '{"fields": [
		   {"name": "business_name", "type": "text", "label": "Business Name", "required": true},
		   {"name": "ownership_percentage", "type": "number", "label": "Ownership %", "required": false, "validation": {"min": 0, "max": 100}},
		   {"name": "business_type", "type": "select", "label": "Business Type", "required": false, "options": [
		     {"value": "corporation", "label": "Corporation"},
		     {"value": "llc", "label": "LLC"},
		     {"value": "partnership", "label": "Partnership"},
		     {"value": "sole_proprietorship", "label": "Sole Proprietorship"},
		     {"value": "other", "label": "Other"}
		   ]},
		   {"name": "industry", "type": "text", "label": "Industry", "required": false}
		 ]}', 4),
		
		('Intellectual Property', 'Patents, trademarks, copyrights, and domain names', 'lightbulb', '#F59E0B', 
		 '{"fields": [
		   {"name": "ip_type", "type": "select", "label": "IP Type", "required": true, "options": [
		     {"value": "patent", "label": "Patent"},
		     {"value": "trademark", "label": "Trademark"},
		     {"value": "copyright", "label": "Copyright"},
		     {"value": "domain", "label": "Domain Name"},
		     {"value": "other", "label": "Other"}
		   ]},
		   {"name": "registration_number", "type": "text", "label": "Registration Number", "required": false},
		   {"name": "expiry_date", "type": "date", "label": "Expiry Date", "required": false},
		   {"name": "jurisdiction", "type": "text", "label": "Jurisdiction", "required": false}
		 ]}', 5),
		
		('Other', 'Miscellaneous assets that do not fit other categories', 'more-horizontal', '#6B7280', 
		 '{"fields": [
		   {"name": "category", "type": "text", "label": "Category", "required": false},
		   {"name": "condition", "type": "select", "label": "Condition", "required": false, "options": [
		     {"value": "new", "label": "New"},
		     {"value": "excellent", "label": "Excellent"},
		     {"value": "good", "label": "Good"},
		     {"value": "fair", "label": "Fair"},
		     {"value": "poor", "label": "Poor"}
		   ]}
		 ]}', 99)
		ON CONFLICT (name) DO NOTHING;
	`
)