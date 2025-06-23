l provide:
- **Comprehensive manual entry system** with intuitive forms and validation
- **Real-time net worth tracking** combining automated and manual data
- **Complete stock consolidation** showing total holdings across all platforms
- **Advanced equity compensation tracking** with vesting schedules and tax planning
- **Flexible data management** with API integration, web scraping, and manual entry fallbacks
- **Portfolio analytics** including concentration risk and performance tracking
- **Mobile-optimized entry** for quick updates on-the-go
- **Audit trail** for all manual entries with change tracking
- **Smart validation** to prevent errors and ensure data consistency
- **Bulk operations** for efficient data management (CSV import/export)

## Key Manual Entry Benefits

1. **Immediate Use**: Can start tracking net worth immediately without waiting for API integrations
2. **Complete Control**: Full control over data accuracy and updates
3. **Backup System**: Manual entry serves as fallback when APIs fail
4. **Flexibility**: Can track any asset type or unusual account structure
5. **Privacy**: No need to share credentials for sensitive accounts
6. **Accuracy**: User can verify and correct any automated data
7. **Total Stock Tracking**: Comprehensive view of all stock holdings regardless of platform

## Getting Started

1. **Start with manual entry** to get immediate value
2. **Add API integrations** progressively as time permits
3. **Use manual entry as backup** for any problematic API connections
4. **Leverage smart features** like auto-price lookup and validation
5. **Regular updates** through mobile-optimized quick entry forms
6. **Export capabilities** to backup data and share with financial advisors

This approach ensures you have a fully functional net worth dashboard from day one, with the flexibility to enhance it with automated data sources over time while maintaining complete control over your financial data.# Real-Time Net Worth Dashboard - Claude Code Implementation

## Project Overview
Create a comprehensive real-time net worth dashboard that aggregates financial data from multiple sources using a plugin architecture for easy extensibility.

## Core Requirements

### 1. Dashboard Features
- **Real-time net worth calculation** (prominent display)
- **Interactive charts** showing balance trends over time
- **Account breakdown** by institution and type
- **Portfolio allocation** visualizations
- **Historical performance** tracking
- **Automated data refresh** (configurable intervals)

### 2. Data Sources to Integrate

#### Direct APIs (Priority 1 - Implement First)
```javascript
const directApiSources = {
  allyInvest: {
    type: 'investment',
    apiType: 'oauth',
    endpoints: {
      accounts: '/v1/accounts',
      balances: '/v1/accounts/{id}/balances',
      positions: '/v1/accounts/{id}/holdings'
    },
    documentation: 'https://www.ally.com/api/invest/documentation/'
  },
  
  fidelityWorkplace: {
    type: 'retirement',
    apiType: 'oauth',
    endpoints: {
      balances: '/workplace/v1/accounts/{id}/balances'
    },
    documentation: 'https://workplacexchange.fidelity.com/public/wpx/docs/wi-balances'
  },
  
  morganStanleyAtWork: {
    type: 'equity_compensation',
    apiType: 'developer_platform',
    features: {
      vestingSchedule: true,
counts/{id}/balance'
    },
    documentation: 'https://wallet.api.live.ledger.com/'
  }
};
```

#### Plaid Integration (Priority 2)
```javascript
const plaidSources = {
  websterBank: {
    type: 'banking',
    institution: 'Webster Bank',
    products: ['transactions', 'accounts', 'balances']
  },
  
  ameriprise: {
    type: 'investment', 
    institution: 'Ameriprise Financial',
    products: ['accounts', 'balances', 'investments']
  },
  
  pncMortgage: {
    type: 'liability',
    institution: 'PNC Bank',
    products: ['accounts', 'balances', 'liabilities']
  },
  
  creditCards: {
    type: 'liability',
    institutions: ['Citi', 'Chase', 'Synchrony'],
    products: ['accounts', 'balances', 'transactions']
  }
};
```

#### Manual Entry Sources (Priority 2)
```javascript
const manualEntrySources = {
  computershare: {
    type: 'stock_holdings',
    dataSource: 'manual',
    schema: {
      fields: [
        { name: 'company_symbol', type: 'text', label: 'Stock Symbol', required: true },
        { name: 'company_name', type: 'text', label: 'Company Name', required: true },
        { name: 'shares_owned', type: 'number', label: 'Total Shares', required: true },
        { name: 'cost_basis', type: 'currency', label: 'Cost Basis per Share', required: false },
        { name: 'dividend_reinvestment', type: 'select', label: 'DRIP Enabled', options: ['Yes', 'No'] },
        { name: 'account_number', type: 'text', label: 'Account Number (Optional)', required: false },
        { name: 'last_updated', type: 'date', label: 'Last Updated', required: true }
      ],
      updateFrequency: 'monthly'
    },
    features: {
      stockPriceLookup: true, // Auto-fetch current price via API
      dividendTracking: true,
      costBasisCalculation: true,
      portfolioConsolidation: true // Combine with other stock holdings
    }
  },
  
  morganStanleyManual: {
    type: 'equity_compensation',
    dataSource: 'manual',
    schema: {
      fields: [
        { name: 'grant_type', type: 'select', label: 'Grant Type', 
          options: ['RSU', 'Stock Options', 'ESPP', 'Restricted Stock'], required: true },
        { name: 'company_symbol', type: 'text', label: 'Company Symbol', required: true },
        { name: 'total_granted', type: 'number', label: 'Total Shares Granted', required: true },
        { name: 'vested_shares', type: 'number', label: 'Currently Vested Shares', required: true },
        { name: 'unvested_shares', type: 'number', label: 'Unvested Shares', required: true },
        { name: 'strike_price', type: 'currency', label: 'Strike Price (Options Only)', required: false },
        { name: 'grant_date', type: 'date', label: 'Grant Date', required: true },
        { name: 'vest_schedule', type: 'text', label: 'Vesting Schedule', 
          placeholder: 'e.g., 25% per year over 4 years', required: false },
        { name: 'next_vest_date', type: 'date', label: 'Next Vesting Date', required: false },
        { name: 'next_vest_shares', type: 'number', label: 'Shares Vesting Next', required: false }
      ],
      updateFrequency: 'monthly'
    },
    features: {
      vestingCalculator: true,
      futureVestingProjection: true,
      taxImplicationEstimator: true,
      exerciseRecommendations: true
    }
  },
  
  propertyValues: {
    type: 'real_estate',
    dataSource: 'manual',
    schema: {
      fields: [
        { name: 'property_address', type: 'text', label: 'Property Address', required: true },
        { name: 'property_type', type: 'select', label: 'Property Type', 
          options: ['Primary Residence', 'Investment Property', 'Vacation Home'], required: true },
        { name: 'estimated_value', type: 'currency', label: 'Current Estimated Value', required: true },
        { name: 'purchase_price', type: 'currency', label: 'Original Purchase Price', required: false },
        { name: 'purchase_date', type: 'date', label: 'Purchase Date', required: false },
        { name: 'mortgage_balance', type: 'currency', label: 'Outstanding Mortgage', required: false },
        { name: 'last_appraisal_date', type: 'date', label: 'Last Appraisal Date', required: false },
        { name: 'value_source', type: 'select', label: 'Value Source', 
          options: ['Professional Appraisal', 'Zillow Estimate', 'Redfin Estimate', 'Personal Estimate'], required: true }
      ],
      updateFrequency: 'monthly'
    },
    features: {
      automaticRedfin: true, // Try to auto-update from Redfin when possible
      equityCalculation: true,
      appreciationTracking: true
    }
  },
  
  otherAssets: {
    type: 'miscellaneous',
    dataSource: 'manual',
    schema: {
      fields: [
        { name: 'asset_name', type: 'text', label: 'Asset Name', required: true },
        { name: 'asset_type', type: 'select', label: 'Asset Type', 
          options: ['Cash', 'Collectibles', 'Business Interest', 'Other Investment', 'Precious Metals'], required: true },
        { name: 'current_value', type: 'currency', label: 'Current Value', required: true },
        { name: 'description', type: 'text', label: 'Description', required: false },
        { name: 'last_updated', type: 'date', label: 'Last Updated', required: true }
      ],
      updateFrequency: 'manual'
    }
  }
};
```

## 3. Plugin Architecture Design

### Core Plugin Interface
```typescript
interface FinancialDataPlugin {
  name: string;
  type: 'banking' | 'investment' | 'cryptocurrency' | 'real_estate' | 'liability' | 'manual';
  dataSource: 'api' | 'scraping' | 'manual';
  
  // Authentication methods
  authenticate(): Promise<AuthResult>;
  
  // Data fetching (for automated plugins)
  getAccounts(): Promise<Account[]>;
  getBalances(): Promise<Balance[]>;
  getTransactions(dateRange?: DateRange): Promise<Transaction[]>;
  
  // Manual data entry support
  supportsManualEntry(): boolean;
  getManualEntrySchema(): ManualEntrySchema;
  validateManualEntry(data: any): ValidationResult;
  processManualEntry(data: any): Promise<ProcessedData>;
  
  // Plugin lifecycle
  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Configuration
  getConfig(): PluginConfig;
  validateConfig(config: PluginConfig): boolean;
}

interface ManualEntrySchema {
  fields: ManualEntryField[];
  validationRules: ValidationRule[];
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'manual';
}

interface ManualEntryField {
  name: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'multiselect';
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select fields
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

### Plugin Manager
```javascript
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.dataCache = new Map();
  }
  
  // Plugin registration
  registerPlugin(plugin: FinancialDataPlugin): void;
  unregisterPlugin(pluginName: string): void;
  
  // Data aggregation
  async fetchAllData(): Promise<AggregatedData>;
  async refreshData(pluginNames?: string[]): Promise<void>;
  
  // Cache management
  getCachedData(pluginName: string): CachedData | null;
  invalidateCache(pluginName?: string): void;
}
```

## 4. Technical Implementation

### Technology Stack
- **Backend**: Node.js/Express or Python FastAPI
- **Frontend**: React/Vue.js with Chart.js or D3.js
- **Database**: SQLite (local) or PostgreSQL (if hosted)
- **Scheduling**: node-cron for periodic data fetching
- **Security**: Encrypted credential storage, OAuth handling

### Security Requirements
```javascript
const securityConfig = {
  credentialStorage: {
    method: 'encrypted_local_storage', // or secure key management service
    encryption: 'AES-256-GCM',
    keyDerivation: 'PBKDF2'
  },
  
  apiSecurity: {
    rateLimiting: true,
    requestTimeout: 30000,
    retryPolicy: 'exponential_backoff',
    ipRestrictions: true // where supported
  },
  
  dataHandling: {
    encryptAtRest: true,
    logSanitization: true,
    sessionManagement: 'secure_cookies'
  }
};
```

### Database Schema
```sql
-- Core tables for financial data
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  plugin_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  institution TEXT,
  data_source TEXT DEFAULT 'api', -- 'api', 'scraping', 'manual'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE balances (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  balance DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual entry data with full audit trail
CREATE TABLE manual_entries (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  entry_type TEXT NOT NULL, -- 'stock_holding', 'equity_grant', 'property', 'misc_asset'
  data_json TEXT NOT NULL, -- JSON blob of the manual entry data
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock holdings (both manual and automated)
CREATE TABLE stock_holdings (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  symbol TEXT NOT NULL,
  company_name TEXT,
  shares_owned DECIMAL(15,6),
  cost_basis DECIMAL(10,4),
  current_price DECIMAL(10,4), -- Auto-updated via market data API
  market_value DECIMAL(15,2) GENERATED ALWAYS AS (shares_owned * current_price) STORED,
  data_source TEXT DEFAULT 'manual', -- 'manual', 'computershare_api', 'broker_api'
  last_price_update TIMESTAMP,
  last_manual_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equity compensation specific tables
CREATE TABLE equity_grants (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  grant_id TEXT UNIQUE,
  grant_type TEXT, -- 'RSU', 'ESPP', 'Stock Options', etc.
  company_symbol TEXT,
  total_shares INTEGER,
  vested_shares INTEGER,
  unvested_shares INTEGER,
  strike_price DECIMAL(10,4), -- for options
  grant_date DATE,
  vest_start_date DATE,
  data_source TEXT DEFAULT 'manual', -- 'manual', 'morgan_stanley_api'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vesting_schedule (
  id INTEGER PRIMARY KEY,
  grant_id INTEGER REFERENCES equity_grants(id),
  vest_date DATE,
  shares_vesting INTEGER,
  cumulative_vested INTEGER,
  is_future_vest BOOLEAN DEFAULT TRUE,
  data_source TEXT DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real estate holdings
CREATE TABLE real_estate (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  property_address TEXT,
  property_type TEXT,
  estimated_value DECIMAL(15,2),
  purchase_price DECIMAL(15,2),
  purchase_date DATE,
  mortgage_balance DECIMAL(15,2),
  equity_value DECIMAL(15,2) GENERATED ALWAYS AS (estimated_value - COALESCE(mortgage_balance, 0)) STORED,
  value_source TEXT, -- 'appraisal', 'zillow', 'redfin', 'manual'
  last_value_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manual entry update log
CREATE TABLE manual_entry_log (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  entry_type TEXT,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  updated_by TEXT DEFAULT 'user',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE net_worth_snapshots (
  id INTEGER PRIMARY KEY,
  total_assets DECIMAL(15,2),
  total_liabilities DECIMAL(15,2),
  net_worth DECIMAL(15,2),
  vested_equity_value DECIMAL(15,2),
  unvested_equity_value DECIMAL(15,2), -- Track but don't include in net worth
  stock_holdings_value DECIMAL(15,2),
  real_estate_equity DECIMAL(15,2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 5. Dashboard Components

### Main Dashboard Layout
```javascript
const DashboardComponents = {
  netWorthCard: {
    display: 'prominent',
    realTime: true,
    comparison: 'previous_period',
    excludeUnvested: true // Key requirement
  },
  
  manualEntrySection: {
    quickEntry: {
      enabled: true,
      commonFields: ['stock_update', 'equity_vest', 'property_value'],
      bulkImport: true // CSV upload capability
    },
    entryForms: {
      stockHoldings: 'computershare_schema',
      equityCompensation: 'morgan_stanley_schema',
      realEstate: 'property_schema',
      miscAssets: 'other_assets_schema'
    },
    validation: {
      realTimeValidation: true,
      duplicateDetection: true,
      priceVerification: true // Verify stock prices against market data
    }
  },
  
  stockConsolidationView: {
    groupBy: 'symbol',
    showTotalShares: true,
    sources: ['computershare', 'morgan_stanley', 'ally', 'other_brokers'],
    aggregateView: {
      totalValue: true,
      unrealizedGains: true,
      dividendIncome: true,
      concentrationRisk: true
    }
  },
  
  equityCompensationSection: {
    vestedValue: 'include_in_net_worth',
    unvestedValue: 'display_separately',
    vestingCalendar: {
      showUpcoming: true,
      timeHorizon: '2_years',
      groupBy: 'month'
    },
    vestingInsights: [
      'next_vesting_event',
      'total_vesting_this_year',
      'monthly_vesting_breakdown'
    ]
  },
  
  accountsOverview: {
    groupBy: ['institution', 'type'],
    showBalances: true,
    showChange: true,
    separateEquityTypes: true,
    showDataSource: true // Indicate manual vs automated
  },
  
  trendCharts: {
    types: ['line', 'area', 'bar'],
    timeframes: ['1W', '1M', '3M', '6M', '1Y', 'ALL'],
    metrics: ['net_worth', 'assets', 'liabilities', 'vested_equity', 'unvested_equity', 'total_stock_value']
  },
  
  allocationCharts: {
    types: ['pie', 'donut', 'treemap'],
    breakdowns: ['by_institution', 'by_asset_type', 'by_risk_level', 'vested_vs_unvested', 'by_stock_symbol']
  },
  
  vestingDashboard: {
    upcomingVests: {
      display: 'calendar_view',
      showNext: 12, // months
      groupBy: 'month'
    },
    vestingProjections: {
      showValueAtVest: true,
      assumeCurrentPrice: true,
      showPotentialTaxes: true
    }
  },
  
  dataManagementSection: {
    lastUpdated: {
      showBySource: true,
      reminderAlerts: true,
      staleDataWarnings: true
    },
    bulkOperations: {
      csvImport: true,
      dataExport: true,
      bulkEdit: true
    }
  }
};
```

### Analytics Features
```javascript
const analyticsFeatures = {
  performanceMetrics: [
    'month_over_month_change',
    'year_over_year_growth',
    'asset_allocation_drift',
    'savings_rate_calculation',
    'equity_compensation_value_growth',
    'vesting_velocity_tracking'
  ],
  
  equityInsights: [
    'upcoming_vesting_events',
    'annual_vesting_projections',
    'exercise_strategy_recommendations',
    'tax_impact_modeling',
    'concentration_risk_analysis',
    'vesting_acceleration_scenarios'
  ],
  
  insights: [
    'spending_pattern_analysis',
    'investment_performance_tracking',
    'debt_to_income_monitoring',
    'goal_progress_tracking',
    'equity_compensation_optimization'
  ],
  
  alerts: [
    'unusual_account_activity',
    'large_balance_changes',
    'upcoming_vesting_events',
    'goal_milestone_achievements',
    'rebalancing_recommendations',
    'exercise_deadline_warnings'
  ]
};
```

## 6. Implementation Phases (AI-Driven Development)

### Phase 1: Foundation & Core APIs (AI Sprint 1)
**Target: 2-3 AI sessions**
1. Set up plugin architecture framework
2. Implement secure credential management
3. Create basic dashboard UI with React/Chart.js
4. Database schema setup with equity-specific tables
5. Implement Kraken plugin (simplest to test)
6. Basic net worth calculation (excluding unvested equity)

### Phase 2: Major API Integrations + Manual Entry (AI Sprint 2)
**Target: 3-4 AI sessions**
1. Implement Ally Invest plugin with OAuth
2. Create comprehensive manual entry system with forms and validation
3. Add stock holdings consolidation across all sources
4. Implement Morgan Stanley at Work plugin (or manual entry alternative)
5. Add vesting schedule tracking and future date calculations
6. Implement Fidelity Workplace plugin
7. Create equity compensation dashboard section
8. Add market data API integration for real-time stock prices
9. Build vesting calendar visualization

### Phase 3: Aggregation & Traditional Banking (AI Sprint 3)
**Target: 2-3 AI sessions**
1. Set up Plaid integration
2. Add Webster Bank, Ameriprise, PNC plugins
3. Enhanced data aggregation with equity vs traditional assets
4. Implement Ledger Live plugin
5. Add credit card tracking (optional, low priority)

### Phase 4: Web Scraping & Advanced Manual Features (AI Sprint 4)
**Target: 2-3 AI sessions**
1. Implement Redfin property value scraping (with manual fallback)
2. Add Computershare web scraping for stock holdings (with manual fallback)
3. Advanced charting with vested vs unvested breakdowns
4. Stock consolidation and concentration risk analysis
5. Bulk data import/export capabilities (CSV support)
6. Enhanced manual entry workflows with data validation
7. Add alert system for vesting events and data staleness
8. Implement data reconciliation between manual and automated sources

### Phase 5: Advanced Features & Polish (AI Sprint 5)
**Target: 1-2 AI sessions**
1. Advanced equity analytics (tax implications, exercise strategies)
2. Performance optimization and caching
3. Error handling and resilience improvements
4. Security audit and testing
5. Documentation and deployment guide

## 7. Manual Entry System Design

### User-Friendly Entry Forms
```javascript
const ManualEntryWorkflows = {
  quickEntryMode: {
    // Single-field updates for frequently changed data
    stockPrice: 'Update share count for existing holdings',
    vestingEvent: 'Record new vesting event',
    propertyValue: 'Update property estimate'
  },
  
  fullEntryMode: {
    // Complete data entry for new accounts/assets
    newStockHolding: 'Add new Computershare stock position',
    newEquityGrant: 'Add new Morgan Stanley equity grant',
    newProperty: 'Add real estate holding'
  },
  
  bulkEntryMode: {
    // CSV import and batch operations
    csvImport: 'Upload CSV file with multiple entries',
    batchUpdate: 'Update multiple entries at once',
    dataSync: 'Sync with exported spreadsheet'
  }
};

// Example form configuration for Computershare stock entry
const ComputershareEntryForm = {
  title: 'Add Computershare Stock Holdings',
  description: 'Enter your direct-registered stock holdings from Computershare',
  sections: [
    {
      title: 'Stock Information',
      fields: [
        {
          name: 'symbol',
          type: 'text',
          label: 'Stock Symbol',
          placeholder: 'e.g., AAPL, MSFT',
          required: true,
          validation: {
            pattern: '^[A-Z]{1,5}

```javascript
const errorHandlingStrategy = {
  apiFailures: {
    retryPolicy: 'exponential_backoff',
    maxRetries: 3,
    fallbackToCache: true,
    userNotification: true
  },
  
  dataInconsistencies: {
    validation: 'strict',
    reconciliation: 'automated_where_possible',
    flagging: 'manual_review_required'
  },
  
  authenticationIssues: {
    tokenRefresh: 'automatic',
    reauthorizationFlow: 'guided',
    gracefulDegradation: true
  }
};
```

## 8. Configuration Management

Create a flexible configuration system:
```json
{
  "refreshIntervals": {
    "realtime_accounts": "5m",
    "daily_accounts": "1h", 
    "property_values": "1d"
  },
  
  "display_preferences": {
    "currency": "USD",
    "date_format": "MM/DD/YYYY",
    "number_format": "en-US"
  },
  
  "plugins": {
    "enabled": ["ally", "kraken", "fidelity", "plaid"],
    "disabled": [],
    "config_overrides": {}
  }
}
```

## Expected Outcomes

This implementation will provide:
- **Real-time net worth tracking** with automatic updates
- **Comprehensive financial overview** across all your accounts
- **Historical trend analysis** with beautiful visualizations  
- **Extensible architecture** for easily adding new financial institutions
- **Secure credential management** with bank-level encryption
- **Automated property value updates** via Redfin integration
- **Portfolio performance analytics** and insights

The plugin architecture ensures you can easily add support for additional institutions or account types in the future without major code changes.

## Getting Started

1. **Clone/create the project structure**
2. **Install dependencies** and set up the development environment
3. **Configure API credentials** for each institution
4. **Start with one plugin** (recommend Kraken as it's simplest to set up)
5. **Gradually add more data sources** following the phased approach
6. **Customize dashboard** based on your preferences

This approach balances security, functionality, and maintainability while providing the comprehensive net worth tracking you're looking for.,
            message: 'Enter a valid stock symbol'
          },
          autoComplete: 'stock-symbol-lookup' // API integration
        },
        {
          name: 'company_name',
          type: 'text',
          label: 'Company Name',
          autoFill: true, // Auto-fill based on symbol
          required: true
        },
        {
          name: 'shares_owned',
          type: 'number',
          label: 'Total Shares Owned',
          placeholder: '0.000',
          required: true,
          precision: 6,
          validation: {
            min: 0.000001,
            message: 'Must own at least fractional shares'
          }
        }
      ]
    },
    {
      title: 'Cost Basis & Purchase Info',
      fields: [
        {
          name: 'cost_basis',
          type: 'currency',
          label: 'Average Cost Basis per Share',
          placeholder: '$0.00',
          required: false,
          helpText: 'Optional - used for gain/loss calculations'
        },
        {
          name: 'dividend_reinvestment',
          type: 'select',
          label: 'Dividend Reinvestment Enabled',
          options: [
            { value: 'yes', label: 'Yes - DRIP enabled' },
            { value: 'no', label: 'No - Cash dividends' },
            { value: 'partial', label: 'Partial reinvestment' }
          ],
          default: 'yes'
        }
      ]
    }
  ],
  smartFeatures: {
    stockPriceLookup: true, // Real-time price from market data API
    duplicateDetection: true, // Check for existing entries
    portfolioAnalysis: true, // Show concentration impact
    taxImplications: true // Estimate tax effects
  }
};
```

### Data Validation & Smart Features
```javascript
const ValidationFeatures = {
  realTimeValidation: {
    stockSymbols: 'Verify against market data API',
    priceReasonableness: 'Flag unusual price entries',
    mathematicalConsistency: 'Ensure totals add up correctly',
    dateLogic: 'Validate vesting dates and sequences'
  },
  
  smartAutoCompletion: {
    companyLookup: 'Auto-complete company names from symbols',
    vestingPatterns: 'Suggest common vesting schedules',
    priceEstimates: 'Pre-fill current market prices',
    duplicateDetection: 'Warn about potential duplicate entries'
  },
  
  dataEnrichment: {
    marketData: 'Auto-update stock prices daily',
    dividendData: 'Track dividend payments and dates',
    sectorClassification: 'Categorize holdings by sector',
    riskMetrics: 'Calculate beta and volatility'
  }
};
```

### Mobile-Optimized Entry
```javascript
const MobileOptimization = {
  quickCapture: {
    photoUpload: 'Take photo of statements for OCR processing',
    voiceEntry: 'Voice-to-text for quick updates',
    smartDefaults: 'Remember common entry patterns'
  },
  
  offlineCapability: {
    localStorage: 'Save entries when offline',
    syncOnConnection: 'Upload when connectivity returns',
    conflictResolution: 'Handle sync conflicts gracefully'
  }
};
```

```javascript
const errorHandlingStrategy = {
  apiFailures: {
    retryPolicy: 'exponential_backoff',
    maxRetries: 3,
    fallbackToCache: true,
    userNotification: true
  },
  
  dataInconsistencies: {
    validation: 'strict',
    reconciliation: 'automated_where_possible',
    flagging: 'manual_review_required'
  },
  
  authenticationIssues: {
    tokenRefresh: 'automatic',
    reauthorizationFlow: 'guided',
    gracefulDegradation: true
  }
};
```

## 8. Configuration Management

Create a flexible configuration system:
```json
{
  "refreshIntervals": {
    "realtime_accounts": "5m",
    "daily_accounts": "1h", 
    "property_values": "1d"
  },
  
  "display_preferences": {
    "currency": "USD",
    "date_format": "MM/DD/YYYY",
    "number_format": "en-US"
  },
  
  "plugins": {
    "enabled": ["ally", "kraken", "fidelity", "plaid"],
    "disabled": [],
    "config_overrides": {}
  }
}
```

## Expected Outcomes

This implementation will provide:
- **Real-time net worth tracking** with automatic updates
- **Comprehensive financial overview** across all your accounts
- **Historical trend analysis** with beautiful visualizations  
- **Extensible architecture** for easily adding new financial institutions
- **Secure credential management** with bank-level encryption
- **Automated property value updates** via Redfin integration
- **Portfolio performance analytics** and insights

The plugin architecture ensures you can easily add support for additional institutions or account types in the future without major code changes.

## Getting Started

1. **Clone/create the project structure**
2. **Install dependencies** and set up the development environment
3. **Configure API credentials** for each institution
4. **Start with one plugin** (recommend Kraken as it's simplest to set up)
5. **Gradually add more data sources** following the phased approach
6. **Customize dashboard** based on your preferences

This approach balances security, functionality, and maintainability while providing the comprehensive net worth tracking you're looking for.      unvestedShares: true,
      exercisableOptions: true,
      grantDetails: true,
      futureDateCalculations: true
    },
    endpoints: {
      grants: '/equity/grants',
      vesting: '/equity/vesting-schedule',
      balances: '/equity/account-balance'
    },
    documentation: 'https://developer.morganstanley.com/',
    note: 'Requires corporate client access through MS Developer Platform'
  },
  
  kraken: {
    type: 'cryptocurrency',
    apiType: 'api_key',
    endpoints: {
      balance: '/0/private/Balance',
      ledger: '/0/private/Ledgers'
    },
    documentation: 'https://docs.kraken.com/'
  },
  
  ledgerLive: {
    type: 'cryptocurrency',
    apiType: 'wallet_api',
    endpoints: {
      accounts: '/accounts',
      balances: '/ac## 8. Stock Consolidation & Portfolio Analytics

### Total Stock Tracking System
```javascript
const StockConsolidationFeatures = {
  crossPlatformAggregation: {
    sources: [
      'computershare_manual',
      'computershare_scraped', 
      'morgan_stanley_equity',
      'ally_brokerage',
      'other_brokers'
    ],
    consolidationRules: {
      matchBy: 'stock_symbol',
      combineShares: true,
      weightedCostBasis: true,
      separateByType: ['vested', 'unvested', 'options']
    }
  },
  
  portfolioAnalytics: {
    concentrationRisk: {
      bySymbol: 'Percentage of total portfolio per stock',
      bySector: 'Industry concentration analysis',
      bySource: 'Platform diversification metrics'
    },
    
    performanceTracking: {
      unrealizedGains: 'Current vs cost basis',
      dividendIncome: 'Annual dividend projections',
      sectorPerformance: 'Performance by industry',
      riskAdjustedReturns: 'Sharpe ratio calculations'
    },
    
    rebalancingInsights: {
      overweightedPositions: 'Positions exceeding target allocation',
      underweightedSectors: 'Areas for potential investment',
      taxEfficientRebalancing: 'Minimize tax impact suggestions'
    }
  },
  
  equityCompensationIntegration: {
    totalCompanyExposure: 'Combined exposure to employer stock',
    vestingImpactOnAllocation: 'How future vesting affects portfolio',
    exerciseStrategies: 'Optimal timing for options exercise',
    diversificationPlanning: 'Reduce employer stock concentration risk'
  }
};

// Portfolio consolidation view
const ConsolidatedPortfolioView = {
  stockSummary: {
    displayFormat: 'grouped_by_symbol',
    showTotalShares: true,
    showTotalValue: true,
    showUnrealizedGainLoss: true,
    breakdownBySources: true
  },
  
  exampleDisplay: {
    'AAPL': {
      totalShares: 150.5,
      totalValue: '$28,500',
      unrealizedGain: '+$5,200 (22.3%)',
      sources: {
        'Computershare': { shares: 100, source: 'manual' },
        'Morgan Stanley RSUs': { shares: 50.5, source: 'equity_comp', vested: true },
        'Ally Brokerage': { shares: 0, source: 'api' }
      },
      alerts: ['High concentration: 15% of total portfolio']
    }
  }
};
```

## 9. Error Handling & Resilience

```javascript
const errorHandlingStrategy = {
  apiFailures: {
    retryPolicy: 'exponential_backoff',
    maxRetries: 3,
    fallbackToCache: true,
    fallbackToManual: true, // Key addition
    userNotification: true
  },
  
  manualEntryValidation: {
    clientSideValidation: 'immediate_feedback',
    serverSideValidation: 'comprehensive_checks',
    gracefulDegradation: 'save_partial_entries',
    autoSave: 'prevent_data_loss'
  },
  
  dataInconsistencies: {
    validation: 'strict',
    reconciliation: 'automated_where_possible',
    flagging: 'manual_review_required',
    userApproval: 'for_significant_changes'
  },
  
  authenticationIssues: {
    tokenRefresh: 'automatic',
    reauthorizationFlow: 'guided',
    gracefulDegradation: true,
    manualOverride: 'always_available'
  }
};
```

## 10. Configuration Management

Create a flexible configuration system:
```json
{
  "refreshIntervals": {
    "realtime_accounts": "5m",
    "daily_accounts": "1h", 
    "property_values": "1d",
    "manual_entry_reminders": "7d"
  },
  
  "display_preferences": {
    "currency": "USD",
    "date_format": "MM/DD/YYYY",
    "number_format": "en-US",
    "show_unvested_separately": true,
    "highlight_manual_entries": true
  },
  
  "plugins": {
    "enabled": ["ally", "kraken", "fidelity", "plaid", "manual_entry"],
    "disabled": [],
    "config_overrides": {},
    "manual_entry_schemas": ["computershare", "morgan_stanley", "real_estate"]
  },
  
  "validation_settings": {
    "strict_mode": true,
    "auto_price_lookup": true,
    "duplicate_detection": true,
    "stale_data_warnings": true
  },
  
  "data_sources": {
    "prefer_api_over_manual": true,
    "manual_override_allowed": true,
    "sync_frequency": "daily",
    "backup_manual_entries": true
  }
}
```

## Expected Outcomes

This enhanced implementation will provide:

- Real-time net worth tracking with automatic updates
- Comprehensive financial overview across all your accounts
- Historical trend analysis with beautiful visualizations
- Extensible architecture for easily adding new financial institutions
- Secure credential management with bank-level encryption
- Automated property value updates via Redfin integration
- Portfolio performance analytics and insights

The plugin architecture ensures you can easily add support for additional institutions or account types in the future without major code changes.
Getting Started

. Clone/create the project structure
. Install dependencies and set up the development environment
. Configure API credentials for each institution
. Start with one plugin (recommend Kraken as it's simplest to set up)
. Gradually add more data sources following the phased approach
. Customize dashboard based on your preferences

This approach balances security, functionality, and maintainability while providing the comprehensive net worth tracking you're looking for.
