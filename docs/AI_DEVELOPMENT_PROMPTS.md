# AI Development Prompts for Real-Time Net Worth Dashboard

## Technology Stack Recommendation

**Backend**: Go with Gin/Echo framework
- **Why Go**: Superior performance, excellent concurrency, strong typing, great for financial data processing
- **Alternative**: Java with Quarkus (if you prefer JVM ecosystem - faster startup, native compilation, good cloud-native features)

**Frontend**: React with TypeScript + Tailwind CSS + Chart.js/Recharts
**Database**: PostgreSQL (more robust than SQLite for production)
**Container**: Podman/Docker
**Orchestration**: Kubernetes with Helm

---

## Phase 1: Foundation & Architecture Setup

### Prompt 1.1: Project Foundation & Database Schema

```
Create a comprehensive foundation for a Real-Time Net Worth Dashboard with the following requirements:

**Project Structure & Technology Stack:**
- Backend: Go with Gin framework, structured for microservices
- Frontend: React with TypeScript, Tailwind CSS, and Recharts for charts
- Database: PostgreSQL with comprehensive schema for financial data
- Containerization: Dockerfile for both frontend and backend
- Local development: docker-compose.yml for easy local testing

**Core Database Schema Requirements:**
Design a robust PostgreSQL schema that supports:

1. **Plugin Architecture Tables:**
   - data_sources (id, name, type, status, config_schema)
   - accounts (id, data_source_id, external_account_id, account_name, account_type, institution, data_source_type)
   - account_balances (id, account_id, balance, currency, timestamp, data_source)

2. **Manual Entry Support:**
   - manual_entries (id, account_id, entry_type, data_json, created_at, updated_at)
   - manual_entry_log (id, account_id, field_changed, old_value, new_value, timestamp, user_id)

3. **Stock Holdings (Critical for consolidation):**
   - stock_holdings (id, account_id, symbol, company_name, shares_owned, cost_basis, current_price, market_value, data_source, last_updated)
   - stock_prices (symbol, price, timestamp) -- for caching market data

4. **Equity Compensation (Key requirement):**
   - equity_grants (id, account_id, grant_type, company_symbol, total_shares, vested_shares, unvested_shares, strike_price, grant_date, vest_start_date)
   - vesting_schedule (id, grant_id, vest_date, shares_vesting, cumulative_vested, is_future_vest)

5. **Real Estate & Other Assets:**
   - real_estate (id, account_id, property_address, property_type, estimated_value, mortgage_balance, equity_value)
   - miscellaneous_assets (id, account_id, asset_name, asset_type, current_value, description)

6. **Net Worth Snapshots:**
   - net_worth_snapshots (id, total_assets, total_liabilities, net_worth, vested_equity_value, unvested_equity_value, timestamp)

**Backend Architecture Requirements:**
- Plugin interface design for financial data sources
- Secure credential management system (encrypted storage, environment variable support)
- RESTful API with proper error handling and validation
- Database migration system
- Configuration management for different environments

**Frontend Foundation:**
- Modern React app with TypeScript
- Responsive design with mobile-first approach
- Component structure for dashboard, charts, manual entry forms
- State management setup (Context API or Zustand)
- API client setup with proper error handling

**Deployment Preparation:**
- Dockerfile for backend (multi-stage build)
- Dockerfile for frontend (nginx-based)
- docker-compose.yml for local development
- Environment variable configuration
- Health check endpoints

**Security Considerations:**
- JWT-based authentication preparation
- API rate limiting
- Input validation and sanitization
- Secure credential storage patterns

Generate the complete project structure with:
1. Database schema with all tables and relationships
2. Go backend with plugin architecture foundation
3. React frontend with basic dashboard layout
4. Docker configuration for both services
5. Documentation for local development setup

Include placeholder API endpoints and UI components that will be implemented in future phases. Focus on creating a solid, extensible foundation.
```

### Prompt 1.2: Secure Configuration & Credential Management

```
Enhance the Net Worth Dashboard project with a comprehensive, secure credential management system:

**Requirements:**
1. **External Service Credential Storage:**
   - Support for API keys, OAuth tokens, username/password combinations
   - Encrypted storage in database with AES-256-GCM encryption
   - Environment-based configuration for encryption keys
   - Per-service credential schema validation

2. **Configuration Architecture:**
   - YAML-based configuration files for different environments (dev, staging, prod)
   - Kubernetes ConfigMap and Secret integration
   - Environment variable override capability
   - Hot-reload configuration support

3. **Credential Types to Support:**
   - Ally Invest: OAuth 2.0 (client_id, client_secret, access_token, refresh_token)
   - Kraken: API Key + Secret
   - Fidelity: OAuth 2.0 + custom headers
   - Morgan Stanley: Developer platform credentials
   - Plaid: API keys (client_id, secret, environment)
   - Market Data APIs: API keys for stock price lookup

4. **Security Implementation:**
   - Credential encryption/decryption service in Go
   - Secure key derivation using PBKDF2 or similar
   - Credential audit logging (access, updates, failures)
   - Automatic token refresh for OAuth services
   - Secure credential validation before storage

5. **Kubernetes Integration:**
   - Helm chart templates for ConfigMaps and Secrets
   - External secret management integration (e.g., HashiCorp Vault compatibility)
   - Pod security contexts and service accounts
   - Network policies for secure communication

6. **Developer Experience:**
   - CLI tool for credential management during development
   - Local credential storage for development (separate from production)
   - Credential testing and validation endpoints
   - Clear documentation for adding new service credentials

**Implementation Structure:**
```go
type CredentialManager interface {
    StoreCredential(serviceType string, credentials interface{}) error
    GetCredential(serviceType string) (interface{}, error)
    RefreshToken(serviceType string) error
    ValidateCredential(serviceType string) error
    DeleteCredential(serviceType string) error
}

type ServiceConfig struct {
    Name            string                 `yaml:"name"`
    Type            string                 `yaml:"type"`
    Enabled         bool                   `yaml:"enabled"`
    CredentialType  string                 `yaml:"credential_type"`
    EndpointConfig  map[string]string      `yaml:"endpoints"`
    RefreshInterval time.Duration          `yaml:"refresh_interval"`
    RateLimit       RateLimitConfig        `yaml:"rate_limit"`
}
```

**Deliverables:**
1. Go credential management service with encryption
2. Configuration system with YAML support
3. Database tables for secure credential storage
4. Kubernetes ConfigMap/Secret templates
5. Development CLI tool for credential management
6. API endpoints for credential CRUD operations
7. Integration tests for credential security
8. Documentation for credential setup and management

Focus on making the system production-ready, secure, and easy to manage across different deployment environments.
```

---

## Phase 2: Core Plugin Architecture & Manual Entry System

### Prompt 2.1: Plugin Architecture Implementation

```
Implement the core plugin architecture for the Net Worth Dashboard with a focus on extensibility and manual entry capabilities:

**Plugin Interface Requirements:**
1. **Standardized Plugin Interface:**
   ```go
   type FinancialDataPlugin interface {
       GetName() string
       GetType() PluginType
       GetDataSource() DataSourceType
       Initialize(config PluginConfig) error
       Authenticate() error
       GetAccounts() ([]Account, error)
       GetBalances() ([]Balance, error)
       GetTransactions(dateRange DateRange) ([]Transaction, error)
       SupportsManualEntry() bool
       GetManualEntrySchema() ManualEntrySchema
       ValidateManualEntry(data interface{}) ValidationResult
       ProcessManualEntry(data interface{}) error
       Disconnect() error
   }
   ```

2. **Plugin Types to Implement:**
   - ManualEntryPlugin (for Computershare, Morgan Stanley manual data)
   - APIPlugin (for Ally, Kraken, Fidelity)
   - ScrapingPlugin (for future web scraping implementations)
   - PlaidPlugin (for bank integrations)

3. **Manual Entry System:**
   - Dynamic form generation based on plugin schemas
   - Real-time validation with market data integration
   - Bulk import/export capabilities (CSV)
   - Mobile-optimized entry forms
   - Auto-save and offline support

4. **Plugin Manager:**
   - Plugin registration and lifecycle management
   - Data aggregation across multiple plugins
   - Error handling and fallback mechanisms
   - Cache management and data synchronization
   - Plugin health monitoring

**Specific Implementations Needed:**

1. **Computershare Manual Entry Plugin:**
   - Stock symbol validation with market data API
   - Share count and cost basis tracking
   - Dividend reinvestment plan (DRIP) settings
   - Automatic price lookup and portfolio valuation

2. **Morgan Stanley Equity Compensation Plugin:**
   - Multiple grant types (RSU, Stock Options, ESPP)
   - Vesting schedule calculation and tracking
   - Future vesting projections
   - Tax implication estimates

3. **Real Estate Manual Entry Plugin:**
   - Property value tracking with Redfin integration
   - Mortgage balance and equity calculation
   - Multiple property support
   - Value source tracking (appraisal, Zillow, manual)

**React Frontend Requirements:**
1. **Dynamic Form System:**
   - Form generator based on plugin schemas
   - Real-time validation with visual feedback
   - Multi-step forms for complex data entry
   - Auto-complete and smart suggestions

2. **Manual Entry Dashboard:**
   - Quick entry cards for common updates
   - Batch entry mode for multiple items
   - Import/export functionality
   - Entry history and audit trail

3. **Plugin Management UI:**
   - Plugin enable/disable controls
   - Configuration screens for each plugin
   - Health status indicators
   - Manual data refresh triggers

**Implementation Deliverables:**
1. Complete plugin architecture in Go
2. Three working manual entry plugins (Computershare, Morgan Stanley, Real Estate)
3. Plugin manager with registration and lifecycle management
4. React components for dynamic form generation
5. Manual entry dashboard with full CRUD operations
6. CSV import/export functionality
7. Market data API integration for stock price lookup
8. Comprehensive error handling and validation
9. Unit and integration tests for all plugins
10. API documentation for plugin development

**Data Flow Requirements:**
- Real-time data validation during entry
- Automatic price updates for stock holdings
- Cross-plugin data consolidation (e.g., total stock holdings)
- Historical data tracking with timestamps
- Conflict resolution for duplicate entries

Focus on creating a system that makes manual entry feel first-class, not like a fallback option. The interface should be intuitive and fast, encouraging regular updates.
```

### Prompt 2.2: Advanced Manual Entry Features & Stock Consolidation

```
Enhance the manual entry system with advanced features and implement comprehensive stock consolidation across all data sources:

**Advanced Manual Entry Features:**
1. **Smart Data Entry:**
   - Auto-completion for stock symbols with company name lookup
   - Price validation against current market data
   - Duplicate detection across all data sources
   - Smart defaults based on user patterns
   - Bulk operations with CSV templates

2. **Mobile-Optimized Experience:**
   - Progressive Web App (PWA) capabilities
   - Offline data entry with sync when online
   - Photo capture for document reference
   - Voice-to-text for quick updates
   - Touch-optimized form controls

3. **Data Quality & Validation:**
   - Real-time market data validation
   - Mathematical consistency checks (shares × price = value)
   - Date logic validation (vesting schedules, purchase dates)
   - Warning system for unusual entries
   - Data completeness scoring

**Stock Consolidation System:**
1. **Cross-Platform Aggregation:**
   ```go
   type StockConsolidator struct {
       Holdings map[string]*ConsolidatedHolding
   }

   type ConsolidatedHolding struct {
       Symbol           string
       CompanyName      string
       TotalShares      decimal.Decimal
       WeightedCostBasis decimal.Decimal
       CurrentPrice     decimal.Decimal
       MarketValue      decimal.Decimal
       UnrealizedGainLoss decimal.Decimal
       Sources          []HoldingSource
       LastUpdated      time.Time
   }

   type HoldingSource struct {
       PluginName    string
       AccountName   string
       Shares        decimal.Decimal
       CostBasis     decimal.Decimal
       DataSource    string // "manual", "api", "scraping"
       LastUpdated   time.Time
   }
   ```

2. **Portfolio Analytics:**
   - Concentration risk analysis (% of total portfolio per stock)
   - Sector allocation breakdown
   - Performance tracking with time-weighted returns
   - Dividend income projections
   - Rebalancing recommendations

3. **Equity Compensation Integration:**
   - Separate tracking of vested vs unvested shares
   - Vesting schedule projections
   - Total company exposure calculation
   - Exercise strategy recommendations
   - Tax-loss harvesting opportunities

**React Frontend Enhancements:**
1. **Stock Consolidation Dashboard:**
   - Interactive portfolio allocation charts
   - Drill-down capability by stock, source, or account
   - Performance metrics with historical trends
   - Concentration risk warnings
   - Export capabilities for tax reporting

2. **Advanced Entry Forms:**
   - Multi-step wizards for complex entries
   - Conditional fields based on selections
   - Real-time calculation previews
   - Undo/redo functionality
   - Save as draft capability

3. **Data Management Tools:**
   - Bulk edit capabilities
   - Data import/export with template generation
   - Reconciliation tools for API vs manual data
   - Audit trail visualization
   - Data quality dashboard

**Market Data Integration:**
1. **Real-Time Price Updates:**
   - Integration with Alpha Vantage, IEX Cloud, or similar
   - Automatic daily price updates
   - Historical price tracking
   - Dividend and split adjustments
   - Currency conversion support

2. **Smart Notifications:**
   - Significant price movements
   - Dividend announcements
   - Upcoming vesting events
   - Rebalancing opportunities
   - Data staleness alerts

**Implementation Requirements:**
1. **Backend Services:**
   - Stock consolidation service with real-time updates
   - Market data service with caching and rate limiting
   - Analytics service for portfolio calculations
   - Notification service for alerts
   - Data quality service for validation

2. **Database Enhancements:**
   - Optimized queries for portfolio aggregation
   - Indexing strategy for performance
   - Data archival and cleanup procedures
   - Backup and recovery processes

3. **Performance Optimization:**
   - Caching strategy for frequently accessed data
   - Background job processing for heavy calculations
   - Database connection pooling
   - API response optimization

**Deliverables:**
1. Enhanced manual entry system with all smart features
2. Complete stock consolidation service
3. Portfolio analytics engine
4. Advanced React dashboard with interactive charts
5. Market data integration with automatic updates
6. Mobile PWA capabilities
7. Comprehensive testing suite
8. Performance benchmarks and optimization
9. User documentation and tutorials
10. API documentation for external integrations

Focus on creating a system that provides professional-grade portfolio management capabilities while maintaining ease of use for manual data entry.
```

---

## Phase 3: API Integrations & External Services

### Prompt 3.1: Priority API Integrations

```
Implement the first wave of API integrations for the Net Worth Dashboard, focusing on the most valuable data sources:

**Priority 1 API Integrations:**

1. **Kraken Cryptocurrency Exchange:**
   - API Type: REST with API key authentication
   - Endpoints: Balance, Account Ledger, Trade History
   - Implementation: Full API client with rate limiting
   - Data: Cryptocurrency balances and transaction history

2. **Alpha Vantage Market Data API:**
   - API Type: REST with API key
   - Purpose: Real-time stock prices, historical data, dividends
   - Implementation: Caching layer with smart refresh logic
   - Rate Limits: 5 calls per minute (free tier)

3. **Ally Invest API:**
   - API Type: OAuth 2.0
   - Endpoints: Accounts, Balances, Holdings, Orders
   - Implementation: Full OAuth flow with token refresh
   - Data: Investment account balances and positions

**Technical Implementation Requirements:**

1. **Go API Client Architecture:**
   ```go
   type APIClient interface {
       Authenticate() error
       RefreshTokens() error
       GetAccounts() ([]Account, error)
       GetBalances() ([]Balance, error)
       GetHistoricalData(params HistoricalParams) ([]HistoricalData, error)
       HandleRateLimit() error
   }

   type RateLimiter interface {
       Allow() bool
       Wait() time.Duration
       Reset()
   }

   type TokenManager interface {
       GetToken() (*Token, error)
       RefreshToken() (*Token, error)
       IsExpired() bool
       Store(*Token) error
   }
   ```

2. **Error Handling & Resilience:**
   - Exponential backoff for API failures
   - Circuit breaker pattern for unreliable APIs
   - Graceful degradation to cached data
   - Detailed logging for troubleshooting
   - User-friendly error messages

3. **Data Synchronization:**
   - Configurable sync intervals per API
   - Delta sync for large datasets
   - Conflict resolution for data inconsistencies
   - Audit trail for all API interactions
   - Manual refresh capabilities

**Specific API Implementations:**

1. **Kraken Integration:**
   ```go
   type KrakenPlugin struct {
       client     *KrakenClient
       apiKey     string
       privateKey string
       rateLimiter *RateLimiter
   }
   
   func (k *KrakenPlugin) GetBalances() ([]Balance, error) {
       // Implementation with proper error handling
       // Rate limiting and retry logic
       // Data transformation to standard format
   }
   ```

2. **Market Data Service:**
   ```go
   type MarketDataService struct {
       provider    MarketDataProvider
       cache       *Cache
       rateLimiter *RateLimiter
   }
   
   func (m *MarketDataService) GetStockPrice(symbol string) (*Price, error) {
       // Check cache first
       // Fetch from API if needed
       // Update cache with TTL
       // Handle rate limits
   }
   ```

3. **Ally Invest OAuth Implementation:**
   ```go
   type AllyInvestPlugin struct {
       oauth      *OAuthClient
       tokenMgr   TokenManager
       httpClient *http.Client
   }
   
   func (a *AllyInvestPlugin) Authenticate() error {
       // OAuth 2.0 flow implementation
       // Token storage and refresh
       // Error handling for auth failures
   }
   ```

**React Frontend Integration:**

1. **API Connection Management:**
   - Connection status indicators
   - OAuth authorization flows
   - API credential management UI
   - Connection testing and validation
   - Reconnection workflows

2. **Real-Time Data Display:**
   - Live balance updates
   - Connection status indicators
   - Last sync timestamps
   - Manual refresh buttons
   - Error state handling

3. **Data Source Management:**
   - Enable/disable API connections
   - Configure sync frequencies
   - View API usage and limits
   - Handle authentication renewal
   - API health monitoring

**Background Job System:**

1. **Scheduled Data Fetching:**
   ```go
   type JobScheduler struct {
       jobs     map[string]*Job
       executor *JobExecutor
       logger   Logger
   }
   
   type Job struct {
       Name        string
       Schedule    string // cron format
       Plugin      FinancialDataPlugin
       LastRun     time.Time
       NextRun     time.Time
       Status      JobStatus
   }
   ```

2. **Job Types:**
   - Balance updates (every 15 minutes for active accounts)
   - Price updates (daily for all held stocks)
   - Historical data backfill (weekly)
   - Token refresh (as needed)
   - Health checks (hourly)

**Deployment & Configuration:**

1. **Environment Configuration:**
   - API credentials via Kubernetes secrets
   - Rate limit configuration per environment
   - Sync frequency settings
   - Feature flags for API enablement
   - Monitoring and alerting setup

2. **Observability:**
   - API call metrics and success rates
   - Response time monitoring
   - Error rate tracking
   - Data freshness indicators
   - Usage quota monitoring

**Deliverables:**
1. Three fully functional API integrations (Kraken, Alpha Vantage, Ally)
2. Robust OAuth 2.0 implementation with token management
3. Rate limiting and error handling framework
4. Background job system for automated data fetching
5. React components for API management
6. Comprehensive monitoring and logging
7. Integration tests for all API clients
8. Documentation for adding new API integrations
9. Performance benchmarks and optimization
10. Security audit of API implementations

**Testing Requirements:**
- Unit tests for all API clients
- Integration tests with mock servers
- End-to-end tests with real API connections
- Load testing for rate limit handling
- Security testing for credential management

Focus on creating reliable, production-ready API integrations that gracefully handle failures and provide excellent user experience.
```

### Prompt 3.2: Plaid Integration & Banking Data

```
Implement comprehensive Plaid integration for banking and traditional investment account data:

**Plaid Integration Scope:**
1. **Supported Institution Types:**
   - Traditional banks (Webster Bank, Chase, etc.)
   - Investment firms (Ameriprise, Schwab, etc.)
   - Credit card companies (Citi, Synchrony, etc.)
   - Mortgage lenders (PNC, Quicken Loans, etc.)
   - 401(k) providers (Fidelity, Vanguard, etc.)

2. **Plaid Products to Integrate:**
   - Accounts: Account metadata and basic info
   - Balances: Real-time account balances
   - Transactions: Transaction history and categorization
   - Investments: Holdings, positions, and transactions
   - Liabilities: Loan balances and payment schedules
   - Identity: Account holder information

**Technical Implementation:**

1. **Plaid Client Architecture:**
   ```go
   type PlaidPlugin struct {
       client      *plaid.APIClient
       config      PlaidConfig
       itemManager *ItemManager
       webhook     *WebhookHandler
   }

   type ItemManager struct {
       items map[string]*PlaidItem
       db    database.Interface
   }

   type PlaidItem struct {
       ItemID       string
       AccessToken  string
       Institution  Institution
       Accounts     []Account
       LastSync     time.Time
       Status       ItemStatus
       Webhook      WebhookConfig
   }
   ```

2. **Link Token and Item Management:**
   ```go
   func (p *PlaidPlugin) CreateLinkToken(userID string) (*LinkToken, error) {
       // Create link token for Plaid Link initialization
       // Handle different product configurations
       // Set appropriate redirect URIs
   }

   func (p *PlaidPlugin) ExchangePublicToken(publicToken string) (*Item, error) {
       // Exchange public token for access token
       // Store item and access token securely
       // Initiate first data sync
   }
   ```

3. **Webhook Integration:**
   ```go
   type WebhookHandler struct {
       processor WebhookProcessor
       verifier  SignatureVerifier
   }

   func (w *WebhookHandler) HandleWebhook(payload []byte) error {
       // Verify webhook signature
       // Process different webhook types
       // Trigger appropriate data updates
       // Handle error scenarios
   }
   ```

**Data Synchronization Strategy:**

1. **Account Data Management:**
   - Initial sync: Full account and transaction history
   - Incremental sync: New transactions and balance updates
   - Daily balance updates for all accounts
   - Transaction categorization and enrichment
   - Duplicate detection and deduplication

2. **Investment Data Processing:**
   ```go
   type InvestmentProcessor struct {
       holdings    map[string]*Holding
       securities  map[string]*Security
       consolidator *StockConsolidator
   }

   func (i *InvestmentProcessor) ProcessHoldings(holdings []plaid.Holding) error {
       // Transform Plaid holdings to internal format
       // Consolidate with manual entry data
       // Update stock consolidation system
       // Calculate portfolio metrics
   }
   ```

3. **Liability Tracking:**
   - Mortgage balances and payment schedules
   - Credit card balances and utilization
   - Auto loans and personal loans
   - Student loan tracking
   - Net worth impact calculations

**React Frontend Components:**

1. **Plaid Link Integration:**
   ```jsx
   const PlaidLinkComponent = ({ onSuccess, onExit }) => {
     const { open, ready } = usePlaidLink({
       token: linkToken,
       onSuccess: (publicToken, metadata) => {
         // Handle successful connection
         exchangePublicToken(publicToken);
         onSuccess(metadata);
       },
       onExit: (err, metadata) => {
         // Handle user exit or errors
         onExit(err, metadata);
       }
     });

     return (
       <button onClick={open} disabled={!ready}>
         Connect Bank Account
       </button>
     );
   };
   ```

2. **Account Management Dashboard:**
   - Institution connection status
   - Account list with balances
   - Connection health indicators
   - Reconnection workflows for expired items
   - Data freshness timestamps

3. **Transaction Management:**
   - Transaction list with search and filtering
   - Category management and customization
   - Spending analysis and trends
   - Export capabilities for tax preparation
   - Manual transaction entry for missing data

**Advanced Features:**

1. **Asset Categorization:**
   ```go
   type AssetCategorizer struct {
       rules map[string]CategorizationRule
   }

   type CategorizationRule struct {
       Conditions []Condition
       Category   AssetCategory
       SubCategory string
       Priority   int
   }
   ```

2. **Net Worth Calculation:**
   - Real-time net worth updates
   - Asset vs liability breakdown
   - Trend analysis and projections
   - Goal tracking and progress monitoring
   - Comparative analysis across time periods

3. **Data Quality Management:**
   - Account connection health monitoring
   - Data completeness scoring
   - Anomaly detection for unusual transactions
   - Balance reconciliation alerts
   - Missing data identification and filling

**Security and Compliance:**

1. **Data Protection:**
   - End-to-end encryption for sensitive data
   - Secure token storage and rotation
   - PCI DSS compliance considerations
   - GDPR and CCPA compliance measures
   - Regular security audits

2. **Access Control:**
   - Multi-factor authentication integration
   - Role-based access control
   - Session management and timeout
   - Audit logging for all data access
   - Secure API endpoint protection

**Error Handling and Recovery:**

1. **Connection Issues:**
   - Automatic retry with exponential backoff
   - Graceful degradation to cached data
   - User notification for connection problems
   - Self-healing mechanisms where possible
   - Manual intervention workflows

2. **Data Consistency:**
   - Transaction idempotency
   - Conflict resolution strategies
   - Data validation and sanitization
   - Rollback mechanisms for failed updates
   - Consistency checks and alerts

**Performance Optimization:**

1. **Efficient Data Processing:**
   - Batch processing for large datasets
   - Incremental sync strategies
   - Caching for frequently accessed data
   - Database query optimization
   - Background job processing

2. **Scalability Considerations:**
   - Connection pooling for database access
   - Rate limiting for API calls
   - Load balancing for webhook handling
   - Horizontal scaling capabilities
   - Resource usage monitoring

**Deliverables:**
1. Complete Plaid integration with all major products
2. Secure item and token management system
3. Webhook handling for real-time updates
4. React components for account connection and management
5. Investment data processing and consolidation
6. Liability tracking and net worth calculation
7. Transaction categorization and analysis tools
8. Comprehensive error handling and recovery
9. Security and compliance implementations
10. Performance optimization and monitoring
11. Integration tests with Plaid Sandbox
12. Documentation for supported institutions
13. User guides for account connection and troubleshooting

Focus on creating a robust, secure, and user-friendly banking integration that handles the complexity of multiple financial institutions while providing reliable data for net worth calculations.
```

---

## Phase 4: Advanced Analytics & Visualization

### Prompt 4.1: Portfolio Analytics Engine

```
Develop a comprehensive portfolio analytics engine for the Net Worth Dashboard with advanced financial calculations and insights:

**Core Analytics Requirements:**

1. **Portfolio Performance Metrics:**
   ```go
   type PerformanceAnalyzer struct {
       calculator  *ReturnsCalculator
       benchmarks  map[string]*Benchmark
       riskMetrics *RiskCalculator
   }

   type PerformanceMetrics struct {
       TotalReturn      decimal.Decimal
       AnnualizedReturn decimal.Decimal
       VolatilityMetrics VolatilityData
       SharpeRatio      decimal.Decimal
       MaxDrawdown      decimal.Decimal
       BetaCoefficient  decimal.Decimal
       AlphaGeneration  decimal.Decimal
       TimeWeightedReturn decimal.Decimal
       MoneyWeightedReturn decimal.Decimal
   }
   ```

2. **Asset Allocation Analysis:**
   - Current vs target allocation tracking
   - Drift detection and rebalancing alerts
   - Geographic diversification analysis
   - Sector concentration risk assessment
   - Asset class performance attribution
   - Currency exposure analysis

3. **Equity Compensation Analytics:**
   ```go
   type EquityAnalyzer struct {
       grants      []EquityGrant
       calculator  *VestingCalculator
       taxEstimator *TaxCalculator
   }

   type VestingProjection struct {
       Date            time.Time
       SharesVesting   int64
       EstimatedValue  decimal.Decimal
       CumulativeValue decimal.Decimal
       TaxImplication  TaxEstimate
       ExerciseStrategy RecommendedAction
   }
   ```

**Advanced Analytics Features:**

1. **Risk Analysis Engine:**
   ```go
   type RiskAnalyzer struct {
       portfolioData *PortfolioData
       marketData    *MarketDataService
       models        map[string]RiskModel
   }

   func (r *RiskAnalyzer) CalculateVaR(confidenceLevel float64, timeHorizon int) (*VaRResult, error) {
       // Value at Risk calculation using Monte Carlo simulation
       // Historical simulation method
       // Parametric approach
   }

   func (r *RiskAnalyzer) StressTest(scenarios []StressScenario) (*StressTestResult, error) {
       // Market crash scenarios (2008, 2020, etc.)
       // Interest rate shock analysis
       // Sector-specific stress tests
       // Custom scenario modeling
   }
   ```

2. **Concentration Risk Assessment:**
   - Single stock concentration limits
   - Employer stock exposure analysis
   - Geographic concentration tracking
   - Sector weight monitoring
   - Correlation analysis between holdings
   - Diversification effectiveness scoring

3. **Tax Optimization Engine:**
   ```go
   type TaxOptimizer struct {
       holdings     []Holding
       transactions []Transaction
       taxRules     TaxRuleEngine
   }

   type TaxOptimizationSuggestion struct {
       Type           OptimizationType // "tax_loss_harvest", "roth_conversion", "rebalance"
       Description    string
       PotentialSavings decimal.Decimal
       RiskLevel      RiskLevel
       Timeline       string
       Prerequisites  []string
   }
   ```

**Real-Time Analytics Dashboard:**

1. **Performance Dashboard Components:**
   ```jsx
   const PerformanceDashboard = () => {
     const [timeframe, setTimeframe] = useState('1Y');
     const [benchmark, setBenchmark] = useState('SP500');
     
     return (
       <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
         <PerformanceChart 
           data={portfolioPerformance} 
           benchmark={benchmarkData}
           timeframe={timeframe}
         />
         <RiskMetricsCard metrics={riskMetrics} />
         <AllocationChart allocation={currentAllocation} />
         <VestingCalendar upcomingVests={vestingData} />
         <ConcentrationRiskAlert risks={concentrationRisks} />
         <TaxOptimizationPanel suggestions={taxSuggestions} />
       </div>
     );
   };

   const PerformanceChart = ({ data, benchmark, timeframe }) => {
     const chartData = useMemo(() => {
       return processPerformanceData(data, benchmark, timeframe);
     }, [data, benchmark, timeframe]);

     return (
       <div className="bg-white p-6 rounded-lg shadow-lg">
         <h3 className="text-lg font-semibold mb-4">Portfolio Performance</h3>
         <ResponsiveContainer width="100%" height={300}>
           <LineChart data={chartData}>
             <CartesianGrid strokeDasharray="3 3" />
             <XAxis dataKey="date" />
             <YAxis />
             <Tooltip />
             <Legend />
             <Line type="monotone" dataKey="portfolio" stroke="#8884d8" strokeWidth={2} />
             <Line type="monotone" dataKey="benchmark" stroke="#82ca9d" strokeWidth={2} />
           </LineChart>
         </ResponsiveContainer>
       </div>
     );
   };
   ```

2. **Interactive Allocation Visualizations:**
   ```jsx
   const AllocationChart = ({ allocation }) => {
     const [viewMode, setViewMode] = useState('pie'); // 'pie', 'treemap', 'sunburst'
     
     return (
       <div className="bg-white p-6 rounded-lg shadow-lg">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">Asset Allocation</h3>
           <select 
             value={viewMode} 
             onChange={(e) => setViewMode(e.target.value)}
             className="border rounded px-3 py-1"
           >
             <option value="pie">Pie Chart</option>
             <option value="treemap">Tree Map</option>
             <option value="sunburst">Sunburst</option>
           </select>
         </div>
         {viewMode === 'pie' && <PieChart data={allocation} />}
         {viewMode === 'treemap' && <TreeMap data={allocation} />}
         {viewMode === 'sunburst' && <SunburstChart data={allocation} />}
       </div>
     );
   };
   ```

3. **Equity Compensation Tracking:**
   ```jsx
   const VestingDashboard = ({ grants, projections }) => {
     return (
       <div className="space-y-6">
         <VestingCalendar 
           events={projections}
           onEventClick={handleVestingEventClick}
         />
         <VestingProjectionChart 
           data={projections}
           timeHorizon="2Y"
         />
         <EquityGrantsTable 
           grants={grants}
           sortable
           filterable
         />
         <ExerciseRecommendations 
           recommendations={exerciseStrategies}
         />
       </div>
     );
   };
   ```

**Market Intelligence Integration:**

1. **Benchmark Comparison Engine:**
   ```go
   type BenchmarkEngine struct {
       benchmarks map[string]*Benchmark
       calculator *PerformanceCalculator
   }

   type Benchmark struct {
       Name        string
       Symbol      string
       DataSource  string
       Weights     map[string]float64 // For custom benchmarks
       Rebalancing RebalancingFrequency
   }

   func (b *BenchmarkEngine) CompareToIndex(portfolio *Portfolio, benchmarkName string) (*Comparison, error) {
       // Calculate relative performance
       // Risk-adjusted returns comparison
       // Tracking error analysis
       // Beta and correlation metrics
   }
   ```

2. **Market Context Analysis:**
   - Economic indicator integration
   - Market regime detection
   - Volatility forecasting
   - Correlation analysis
   - Sector rotation insights
   - Currency impact analysis

**Advanced Visualization Components:**

1. **Interactive Portfolio Map:**
   ```jsx
   const PortfolioMap = ({ holdings }) => {
     const [selectedMetric, setSelectedMetric] = useState('value');
     const [colorScale, setColorScale] = useState('performance');
     
     return (
       <div className="h-96 w-full">
         <TreeMap
           data={holdings}
           identity="symbol"
           value={selectedMetric}
           valueFormat=".2s"
           margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
           labelSkipSize={12}
           labelTextColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
           parentLabelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
           borderColor={{ from: 'color', modifiers: [['darker', 0.1]] }}
           colors={getColorScale(colorScale)}
           animate
           motionStiffness={70}
           motionDamping={11}
         />
       </div>
     );
   };
   ```

2. **Performance Attribution Analysis:**
   ```jsx
   const AttributionChart = ({ attributionData }) => {
     return (
       <div className="bg-white p-6 rounded-lg shadow-lg">
         <h3 className="text-lg font-semibold mb-4">Performance Attribution</h3>
         <ResponsiveContainer width="100%" height={400}>
           <BarChart data={attributionData} layout="vertic<">
             <CartesianGrid strokeDasharray="3 3" />
             <XAxis type="number" />
             <YAxis dataKey="category" type="category" width={80} />
             <Tooltip />
             <Legend />
             <Bar dataKey="allocation" fill="#8884d8" />
             <Bar dataKey="selection" fill="#82ca9d" />
             <Bar dataKey="interaction" fill="#ffc658" />
           </BarChart>
         </ResponsiveContainer>
       </div>
     );
   };
   ```

**Automated Insights & Alerts:**

1. **Smart Notification System:**
   ```go
   type InsightEngine struct {
       analyzer    *PortfolioAnalyzer
       alertRules  []AlertRule
       notifier    NotificationService
   }

   type Alert struct {
       Type        AlertType
       Severity    AlertSeverity
       Title       string
       Description string
       ActionItems []ActionItem
       Timestamp   time.Time
       Dismissed   bool
   }

   func (i *InsightEngine) GenerateInsights() ([]Insight, error) {
       insights := []Insight{}
       
       // Concentration risk alerts
       if risk := i.analyzer.CheckConcentrationRisk(); risk.Level > HighRisk {
           insights = append(insights, createConcentrationAlert(risk))
       }
       
       // Rebalancing opportunities
       if drift := i.analyzer.CalculateAllocationDrift(); drift > 5.0 {
           insights = append(insights, createRebalancingAlert(drift))
       }
       
       // Tax optimization opportunities
       if opportunities := i.analyzer.FindTaxOptimizations(); len(opportunities) > 0 {
           insights = append(insights, createTaxOptimizationAlert(opportunities))
       }
       
       return insights, nil
   }
   ```

2. **Goal Tracking System:**
   ```go
   type GoalTracker struct {
       goals     []FinancialGoal
       progress  map[string]*Progress
       projector *GoalProjector
   }

   type FinancialGoal struct {
       ID          string
       Name        string
       TargetValue decimal.Decimal
       TargetDate  time.Time
       Category    GoalCategory
       Priority    Priority
       Milestones  []Milestone
   }
   ```

**Performance Optimization:**

1. **Calculation Engine:**
   ```go
   type CalculationEngine struct {
       cache       *Cache
       scheduler   *JobScheduler
       calculator  *ParallelCalculator
   }

   func (c *CalculationEngine) CalculatePortfolioMetrics(portfolioID string) (*Metrics, error) {
       // Use goroutines for parallel calculations
       // Cache intermediate results
       // Optimize database queries
       // Handle large datasets efficiently
   }
   ```

2. **Caching Strategy:**
   - Redis for frequently accessed calculations
   - In-memory caching for real-time data
   - Database query result caching
   - API response caching with TTL
   - Intelligent cache invalidation

**Deliverables:**
1. Complete portfolio analytics engine with all performance metrics
2. Advanced risk analysis tools including VaR and stress testing
3. Comprehensive equity compensation analytics
4. Interactive React dashboard with advanced visualizations
5. Real-time performance tracking and benchmarking
6. Automated insight generation and alert system
7. Tax optimization recommendations engine
8. Goal tracking and progress monitoring
9. Mobile-responsive analytics interface
10. Performance optimization and caching implementation
11. Comprehensive testing suite for all calculations
12. API documentation for analytics endpoints
13. User guides for interpreting analytics
14. Export capabilities for external analysis tools

Focus on creating institutional-quality analytics that provide actionable insights while remaining accessible to individual investors. Ensure all calculations are accurate, performant, and properly tested.
```

### Prompt 4.2: Advanced Charting & Data Visualization

```
Create a comprehensive, interactive charting and visualization system for the Net Worth Dashboard with professional-grade financial charts:

**Advanced Charting Requirements:**

1. **Multi-Timeframe Analysis:**
   ```jsx
   const MultiTimeframeChart = ({ data, metrics }) => {
     const [timeframes, setTimeframes] = useState(['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']);
     const [activeTimeframe, setActiveTimeframe] = useState('1Y');
     const [comparisonMode, setComparisonMode] = useState('absolute'); // 'absolute', 'percentage', 'normalized'
     
     return (
       <div className="h-96 w-full bg-white rounded-lg shadow-lg p-6">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">Net Worth Trend</h3>
           <div className="flex space-x-2">
             {timeframes.map(tf => (
               <button
                 key={tf}
                 onClick={() => setActiveTimeframe(tf)}
                 className={`px-3 py-1 rounded ${
                   activeTimeframe === tf 
                     ? 'bg-blue-500 text-white' 
                     : 'bg-gray-200 text-gray-700'
                 }`}
               >
                 {tf}
               </button>
             ))}
           </div>
         </div>
         <ResponsiveContainer width="100%" height="85%">
           <ComposedChart data={processedData}>
             <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
             <XAxis 
               dataKey="date" 
               tick={{ fontSize: 12 }}
               tickFormatter={formatDateTick}
             />
             <YAxis 
               yAxisId="left"
               tick={{ fontSize: 12 }}
               tickFormatter={formatCurrencyTick}
             />
             <YAxis 
               yAxisId="right"
               orientation="right"
               tick={{ fontSize: 12 }}
               tickFormatter={formatPercentageTick}
             />
             <Tooltip content={<CustomTooltip />} />
             <Legend />
             <Area
               yAxisId="left"
               type="monotone"
               dataKey="totalAssets"
               stackId="1"
               stroke="#8884d8"
               fill="#8884d8"
               fillOpacity={0.6}
             />
             <Area
               yAxisId="left"
               type="monotone"
               dataKey="totalLiabilities"
               stackId="1"
               stroke="#82ca9d"
               fill="#82ca9d"
               fillOpacity={0.6}
             />
             <Line
               yAxisId="left"
               type="monotone"
               dataKey="netWorth"
               stroke="#ff7300"
               strokeWidth={3}
               dot={false}
             />
             <Line
               yAxisId="right"
               type="monotone"
               dataKey="monthlyGrowthRate"
               stroke="#ff0000"
               strokeWidth={2}
               strokeDasharray="5 5"
               dot={false}
             />
           </ComposedChart>
         </ResponsiveContainer>
       </div>
     );
   };
   ```

2. **Interactive Portfolio Allocation Charts:**
   ```jsx
   const AdvancedAllocationChart = ({ data, level = 'category' }) => {
     const [viewType, setViewType] = useState('sunburst');
     const [drilldownLevel, setDrilldownLevel] = useState(0);
     const [selectedSegment, setSelectedSegment] = useState(null);
     
     const handleSegmentClick = (segment) => {
       setSelectedSegment(segment);
       if (segment.children && segment.children.length > 0) {
         setDrilldownLevel(prev => prev + 1);
       }
     };
     
     return (
       <div className="bg-white rounded-lg shadow-lg p-6">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">Portfolio Allocation</h3>
           <div className="flex space-x-2">
             <select 
               value={viewType} 
               onChange={(e) => setViewType(e.target.value)}
               className="border rounded px-3 py-1"
             >
               <option value="sunburst">Sunburst</option>
               <option value="treemap">TreeMap</option>
               <option value="donut">Donut Chart</option>
               <option value="sankey">Sankey Diagram</option>
             </select>
           </div>
         </div>
         
         <div className="h-96 relative">
           {viewType === 'sunburst' && (
             <SunburstChart 
               data={data}
               onClick={handleSegmentClick}
               centerText={selectedSegment?.name || 'Portfolio'}
               animate
             />
           )}
           {viewType === 'treemap' && (
             <TreeMapChart 
               data={data}
               onClick={handleSegmentClick}
               colorScale="viridis"
               labelFormat={(d) => `${d.name}\n${formatCurrency(d.value)}`}
             />
           )}
           {viewType === 'donut' && (
             <DonutChart 
               data={data}
               onClick={handleSegmentClick}
               innerRadius={60}
               outerRadius={120}
               centerContent={<CenterContent data={selectedSegment} />}
             />
           )}
         </div>
         
         {selectedSegment && (
           <AllocationDetails 
             segment={selectedSegment}
             onClose={() => setSelectedSegment(null)}
           />
         )}
       </div>
     );
   };
   ```

3. **Performance Comparison Charts:**
   ```jsx
   const PerformanceComparisonChart = ({ portfolioData, benchmarks }) => {
     const [selectedBenchmarks, setSelectedBenchmarks] = useState(['SP500', 'NASDAQ']);
     const [metric, setMetric] = useState('cumulativeReturn');
     const [riskAdjusted, setRiskAdjusted] = useState(false);
     
     return (
       <div className="bg-white rounded-lg shadow-lg p-6">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">Performance vs Benchmarks</h3>
           <div className="flex space-x-2">
             <select 
               value={metric} 
               onChange={(e) => setMetric(e.target.value)}
               className="border rounded px-3 py-1"
             >
               <option value="cumulativeReturn">Cumulative Return</option>
               <option value="rollingReturn">Rolling Return</option>
               <option value="drawdown">Drawdown</option>
               <option value="sharpeRatio">Sharpe Ratio</option>
             </select>
             <label className="flex items-center">
               <input
                 type="checkbox"
                 checked={riskAdjusted}
                 onChange={(e) => setRiskAdjusted(e.target.checked)}
                 className="mr-2"
               />
               Risk Adjusted
             </label>
           </div>
         </div>
         
         <ResponsiveContainer width="100%" height={300}>
           <LineChart data={processComparisonData(portfolioData, benchmarks, metric)}>
             <CartesianGrid strokeDasharray="3 3" />
             <XAxis dataKey="date" />
             <YAxis tickFormatter={formatMetricTick(metric)} />
             <Tooltip content={<ComparisonTooltip />} />
             <Legend />
             <Line 
               type="monotone" 
               dataKey="portfolio" 
               stroke="#8884d8" 
               strokeWidth={3}
               name="Your Portfolio"
             />
             {selectedBenchmarks.map((benchmark, index) => (
               <Line
                 key={benchmark}
                 type="monotone"
                 dataKey={benchmark}
                 stroke={colors[index]}
                 strokeWidth={2}
                 strokeDasharray="5 5"
                 name={benchmarkNames[benchmark]}
               />
             ))}
           </LineChart>
         </ResponsiveContainer>
       </div>
     );
   };
   ```

**Advanced Chart Types:**

1. **Correlation Matrix Heatmap:**
   ```jsx
   const CorrelationHeatmap = ({ correlationData }) => {
     return (
       <div className="bg-white rounded-lg shadow-lg p-6">
         <h3 className="text-lg font-semibold mb-4">Asset Correlation Matrix</h3>
         <div className="overflow-auto">
           <div className="grid gap-1" style={{
             gridTemplateColumns: `repeat(${correlationData.length + 1}, minmax(80px, 1fr))`
           }}>
             <div></div>
             {correlationData.map(item => (
               <div key={item.symbol} className="text-xs font-medium p-2 text-center">
                 {item.symbol}
               </div>
             ))}
             {correlationData.map((row, i) => (
               <React.Fragment key={row.symbol}>
                 <div className="text-xs font-medium p-2">{row.symbol}</div>
                 {row.correlations.map((corr, j) => (
                   <div 
                     key={j}
                     className="p-2 text-xs text-center text-white"
                     style={{
                       backgroundColor: getCorrelationColor(corr),
                     }}
                   >
                     {corr.toFixed(2)}
                   </div>
                 ))}
               </React.Fragment>
             ))}
           </div>
         </div>
       </div>
     );
   };
   ```

2. **Risk-Return Scatter Plot:**
   ```jsx
   const RiskReturnScatter = ({ holdings }) => {
     return (
       <div className="bg-white rounded-lg shadow-lg p-6">
         <h3 className="text-lg font-semibold mb-4">Risk vs Return Analysis</h3>
         <ResponsiveContainer width="100%" height={400}>
           <ScatterChart data={holdings}>
             <CartesianGrid strokeDasharray="3 3" />
             <XAxis 
               type="number" 
               dataKey="volatility" 
               name="Risk (Volatility)"
               tickFormatter={formatPercentage}
             />
             <YAxis 
               type="number" 
               dataKey="return" 
               name="Return"
               tickFormatter={formatPercentage}
             />
             <Tooltip content={<RiskReturnTooltip />} />
             <Scatter dataKey="value" fill="#8884d8">
               {holdings.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={getQuadrantColor(entry)} />
               ))}
             </Scatter>
             <ReferenceLine 
               x={benchmarkVolatility} 
               stroke="red" 
               strokeDasharray="5 5"
               label="Market Volatility"
             />
             <ReferenceLine 
               y={benchmarkReturn} 
               stroke="red" 
               strokeDasharray="5 5"
               label="Market Return"
             />
           </ScatterChart>
         </ResponsiveContainer>
       </div>
     );
   };
   ```

3. **Vesting Schedule Gantt Chart:**
   ```jsx
   const VestingGanttChart = ({ vestingSchedule }) => {
     const [timeRange, setTimeRange] = useState('2Y');
     const [groupBy, setGroupBy] = useState('quarter');
     
     return (
       <div className="bg-white rounded-lg shadow-lg p-6">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">Vesting Schedule</h3>
           <div className="flex space-x-2">
             <select 
               value={timeRange} 
               onChange={(e) => setTimeRange(e.target.value)}
               className="border rounded px-3 py-1"
             >
               <option value="1Y">1 Year</option>
               <option value="2Y">2 Years</option>
               <option value="5Y">5 Years</option>
               <option value="ALL">All Time</option>
             </select>
             <select 
               value={groupBy} 
               onChange={(e) => setGroupBy(e.target.value)}
               className="border rounded px-3 py-1"
             >
               <option value="month">Monthly</option>
               <option value="quarter">Quarterly</option>
               <option value="year">Yearly</option>
             </select>
           </div>
         </div>
         
         <div className="h-64 overflow-y-auto">
           {processVestingData(vestingSchedule, timeRange, groupBy).map((grant, index) => (
             <div key={grant.id} className="mb-4">
               <div className="text-sm font-medium mb-2">
                 {grant.companyName} - {grant.grantType}
               </div>
               <div className="relative">
                 <div className="h-8 bg-gray-200 rounded">
                   {grant.vestingPeriods.map((period, periodIndex) => (
                     <div
                       key={periodIndex}
                       className="absolute h-full bg-blue-500 rounded"
                       style={{
                         left: `${period.startPercent}%`,
                         width: `${period.widthPercent}%`,
                         backgroundColor: getVestingColor(period.status)
                       }}
                       title={`${period.shares} shares vesting on ${period.date}`}
                     />
                   ))}
                 </div>
                 <div className="flex justify-between text-xs text-gray-500 mt-1">
                   <span>{grant.startDate}</span>
                   <span>{grant.endDate}</span>
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>
     );
   };
   ```

**Interactive Dashboard Features:**

1. **Real-Time Data Updates:**
   ```jsx
   const useRealTimeData = (endpoint, interval = 30000) => {
     const [data, setData] = useState(null);
     const [lastUpdate, setLastUpdate] = useState(null);
     const [isLoading, setIsLoading] = useState(true);
     
     useEffect(() => {
       const fetchData = async () => {
         try {
           const response = await fetch(endpoint);
           const newData = await response.json();
           setData(newData);
           setLastUpdate(new Date());
           setIsLoading(false);
         } catch (error) {
           console.error('Error fetching real-time data:', error);
         }
       };
       
       fetchData();
       const intervalId = setInterval(fetchData, interval);
       
       return () => clearInterval(intervalId);
     }, [endpoint, interval]);
     
     return { data, lastUpdate, isLoading };
   };
   ```

2. **Chart Export and Sharing:**
   ```jsx
   const ChartExportMenu = ({ chartRef, chartTitle }) => {
     const [isOpen, setIsOpen] = useState(false);
     
     const exportChart = async (format) => {
       const canvas = await html2canvas(chartRef.current);
       
       switch (format) {
         case 'png':
           downloadCanvas(canvas, `${chartTitle}.png`);
           break;
         case 'pdf':
           const pdf = new jsPDF();
           pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, 190, 100);
           pdf.save(`${chartTitle}.pdf`);
           break;
         case 'svg':
           // SVG export logic
           break;
       }
       
       setIsOpen(false);
     };
     
     return (
       <div className="relative">
         <button 
           onClick={() => setIsOpen(!isOpen)}
           className="p-2 text-gray-600 hover:text-gray-800"
         >
           <DownloadIcon size={16} />
         </button>
         {isOpen && (
           <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
             <button 
               onClick={() => exportChart('png')}
               className="block w-full text-left px-4 py-2 hover:bg-gray-100"
             >
               Export as PNG
             </button>
             <button 
               onClick={() => exportChart('pdf')}
               className="block w-full text-left px-4 py-2 hover:bg-gray-100"
             >
               Export as PDF
             </button>
             <button 
               onClick={() => exportChart('svg')}
               className="block w-full text-left px-4 py-2 hover:bg-gray-100"
             >
               Export as SVG
             </button>
           </div>
         )}
       </div>
     );
   };
   ```

**Mobile-Responsive Chart Components:**

1. **Adaptive Chart Layouts:**
   ```jsx
   const ResponsiveChart = ({ children, minHeight = 200 }) => {
     const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
     const containerRef = useRef();
     
     useEffect(() => {
       const updateDimensions = () => {
         if (containerRef.current) {
           const { width } = containerRef.current.getBoundingClientRect();
           setDimensions({
             width,
             height: Math.max(width * 0.6, minHeight)
           });
         }
       };
       
       updateDimensions();
       window.addEventListener('resize', updateDimensions);
       return () => window.removeEventListener('resize', updateDimensions);
     }, [minHeight]);
     
     return (
       <div ref={containerRef} className="w-full">
         <ResponsiveContainer width="100%" height={dimensions.height}>
           {children}
         </ResponsiveContainer>
       </div>
     );
   };
   ```

**Performance Optimization:**

1. **Chart Data Processing:**
   ```jsx
   const useChartData = (rawData, processingFunction, dependencies = []) => {
     return useMemo(() => {
       if (!rawData) return null;
       return processingFunction(rawData);
     }, [rawData, ...dependencies]);
   };
   
   const useVirtualizedChart = (data, itemHeight = 50) => {
     const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
     
     const handleScroll = useCallback((scrollTop) => {
       const start = Math.floor(scrollTop / itemHeight);
       const end = start + Math.ceil(window.innerHeight / itemHeight);
       setVisibleRange({ start, end });
     }, [itemHeight]);
     
     const visibleData = useMemo(() => {
       return data.slice(visibleRange.start, visibleRange.end);
     }, [data, visibleRange]);
     
     return { visibleData, handleScroll };
   };
   ```

**Deliverables:**
1. Complete advanced charting library with 15+ chart types
2. Interactive portfolio visualization components
3. Real-time data integration with WebSocket support
4. Mobile-responsive chart layouts
5. Chart export and sharing functionality
6. Performance optimization for large datasets
7. Customizable dashboard layout system
8. Advanced tooltip and interaction system
9. Color theming and accessibility features
10. Chart animation and transition effects
11. Data processing and transformation utilities
12. Integration tests for all chart components
13. Storybook documentation for chart components
14. Performance benchmarks and optimization guides

Focus on creating charts that are both visually appealing and functionally rich, providing users with deep insights into their financial data while maintaining excellent performance and usability across all devices.
```

---

## Phase 5: Deployment & Production Readiness

### Prompt 5.1: Kubernetes Deployment & Helm Charts

```
Create a complete Kubernetes deployment strategy for the Net Worth Dashboard with Helm charts, security best practices, and production-ready configurations:

**Helm Chart Structure & Requirements:**

1. **Chart Organization:**
   ```yaml
   # Chart.yaml
   apiVersion: v2
   name: networth-dashboard
   description: A comprehensive real-time net worth tracking dashboard
   type: application
   version: 0.1.0
   appVersion: "1.0.0"
   keywords:
     - finance
     - dashboard
     - personal-finance
     - portfolio-management
   maintainers:
     - name: Your Name
       email: your.email@domain.com
   ```

2. **Values Structure:**
   ```yaml
   # values.yaml
   global:
     imageRegistry: ""
     imagePullSecrets: []
     storageClass: ""
   
   replicaCount: 2
   
   image:
     repository: networth-dashboard
     pullPolicy: IfNotPresent
     tag: "latest"
   
   backend:
     image:
       repository: networth-backend
       tag: "latest"
     replicaCount: 2
     resources:
       limits:
         cpu: 1000m
         memory: 1Gi
       requests:
         cpu: 500m
         memory: 512Mi
     autoscaling:
       enabled: true
       minReplicas: 2
       maxReplicas: 10
       targetCPUUtilizationPercentage: 70
   
   frontend:
     image:
       repository: networth-frontend
       tag: "latest"
     replicaCount: 2
     resources:
       limits:
         cpu: 500m
         memory: 512Mi
       requests:
         cpu: 250m
         memory: 256Mi
   
   postgresql:
     enabled: true
     auth:
       postgresPassword: ""
       username: "networth"
       password: ""
       database: "networth_db"
     primary:
       persistence:
         enabled: true
         size: 20Gi
         storageClass: "fast-ssd"
     metrics:
       enabled: true
   
   redis:
     enabled: true
     auth:
       enabled: true
       password: ""
     master:
       persistence:
         enabled: true
         size: 8Gi
   
   ingress:
     enabled: true
     className: "nginx"
     annotations:
       cert-manager.io/cluster-issuer: "letsencrypt-prod"
       nginx.ingress.kubernetes.io/ssl-redirect: "true"
       nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
     hosts:
       - host: networth.yourdomain.com
         paths:
           - path: /
             pathType: Prefix
     tls:
       - secretName: networth-dashboard-tls
         hosts:
           - networth.yourdomain.com
   
   serviceAccount:
     create: true
     annotations: {}
     name: ""
   
   podAnnotations: {}
   
   podSecurityContext:
     fsGroup: 2000
   
   securityContext:
     capabilities:
       drop:
       - ALL
     readOnlyRootFilesystem: true
     runAsNonRoot: true
     runAsUser: 1000
   
   service:
     type: ClusterIP
     port: 80
   
   monitoring:
     enabled: true
     serviceMonitor:
       enabled: true
       interval: 30s
     grafana:
       enabled: true
       dashboards:
         enabled: true
   
   backup:
     enabled: true
     schedule: "0 2 * * *"
     retention: "30d"
     storage:
       size: 50Gi
   
   secrets:
     external:
       enabled: false
       secretStore: ""
     encryption:
       key: ""
   
   config:
     app:
       logLevel: "info"
       environment: "production"
       corsOrigins: ["https://networth.yourdomain.com"]
     database:
       maxConnections: 20
       connectionTimeout: "30s"
     redis:
       ttl: "1h"
       maxMemory: "256mb"
     security:
       jwtSecret: ""
       encryptionKey: ""
     apis:
       rateLimiting:
         enabled: true
         requests: 100
         window: "1m"
   ```

3. **Deployment Templates:**
   ```yaml
   # templates/backend-deployment.yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}-backend
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
       app.kubernetes.io/component: backend
   spec:
     {{- if not .Values.backend.autoscaling.enabled }}
     replicas: {{ .Values.backend.replicaCount }}
     {{- end }}
     selector:
       matchLabels:
         {{- include "networth-dashboard.selectorLabels" . | nindent 6 }}
         app.kubernetes.io/component: backend
     template:
       metadata:
         annotations:
           checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
           checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
           {{- with .Values.podAnnotations }}
           {{- toYaml . | nindent 8 }}
           {{- end }}
         labels:
           {{- include "networth-dashboard.selectorLabels" . | nindent 8 }}
           app.kubernetes.io/component: backend
       spec:
         {{- with .Values.imagePullSecrets }}
         imagePullSecrets:
           {{- toYaml . | nindent 8 }}
         {{- end }}
         serviceAccountName: {{ include "networth-dashboard.serviceAccountName" . }}
         securityContext:
           {{- toYaml .Values.podSecurityContext | nindent 8 }}
         initContainers:
         - name: db-migration
           image: "{{ .Values.backend.image.repository }}:{{ .Values.backend.image.tag }}"
           command: ["/app/migrate"]
           env:
             - name: DATABASE_URL
               valueFrom:
                 secretKeyRef:
                   name: {{ include "networth-dashboard.fullname" . }}-secret
                   key: database-url
         containers:
         - name: backend
           securityContext:
             {{- toYaml .Values.securityContext | nindent 12 }}
           image: "{{ .Values.backend.image.repository }}:{{ .Values.backend.image.tag | default .Chart.AppVersion }}"
           imagePullPolicy: {{ .Values.backend.image.pullPolicy }}
           ports:
           - name: http
             containerPort: 8080
             protocol: TCP
           - name: metrics
             containerPort: 9090
             protocol: TCP
           livenessProbe:
             httpGet:
               path: /health
               port: http
             initialDelaySeconds: 30
             periodSeconds: 10
           readinessProbe:
             httpGet:
               path: /ready
               port: http
             initialDelaySeconds: 5
             periodSeconds: 5
           env:
           - name: DATABASE_URL
             valueFrom:
               secretKeyRef:
                 name: {{ include "networth-dashboard.fullname" . }}-secret
                 key: database-url
           - name: REDIS_URL
             valueFrom:
               secretKeyRef:
                 name: {{ include "networth-dashboard.fullname" . }}-secret
                 key: redis-url
           - name: JWT_SECRET
             valueFrom:
               secretKeyRef:
                 name: {{ include "networth-dashboard.fullname" . }}-secret
                 key: jwt-secret
           - name: ENCRYPTION_KEY
             valueFrom:
               secretKeyRef:
                 name: {{ include "networth-dashboard.fullname" . }}-secret
                 key: encryption-key
           volumeMounts:
           - name: config
             mountPath: /app/config
           - name: tmp
             mountPath: /tmp
           resources:
             {{- toYaml .Values.backend.resources | nindent 12 }}
         volumes:
         - name: config
           configMap:
             name: {{ include "networth-dashboard.fullname" . }}-config
         - name: tmp
           emptyDir: {}
         {{- with .Values.nodeSelector }}
         nodeSelector:
           {{- toYaml . | nindent 8 }}
         {{- end }}
         {{- with .Values.affinity }}
         affinity:
           {{- toYaml . | nindent 8 }}
         {{- end }}
         {{- with .Values.tolerations }}
         tolerations:
           {{- toYaml . | nindent 8 }}
         {{- end }}
   ```

4. **Security & Secrets Management:**
   ```yaml
   # templates/secret.yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}-secret
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
   type: Opaque
   data:
     database-url: {{ printf "postgresql://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "networth-dashboard.fullname" .) .Values.postgresql.auth.database | b64enc }}
     redis-url: {{ printf "redis://:%s@%s-redis-master:6379" .Values.redis.auth.password (include "networth-dashboard.fullname" .) | b64enc }}
     jwt-secret: {{ .Values.config.security.jwtSecret | b64enc }}
     encryption-key: {{ .Values.config.security.encryptionKey | b64enc }}
     {{- if .Values.apis.ally.enabled }}
     ally-client-id: {{ .Values.apis.ally.clientId | b64enc }}
     ally-client-secret: {{ .Values.apis.ally.clientSecret | b64enc }}
     {{- end }}
     {{- if .Values.apis.kraken.enabled }}
     kraken-api-key: {{ .Values.apis.kraken.apiKey | b64enc }}
     kraken-private-key: {{ .Values.apis.kraken.privateKey | b64enc }}
     {{- end }}
     {{- if .Values.apis.plaid.enabled }}
     plaid-client-id: {{ .Values.apis.plaid.clientId | b64enc }}
     plaid-secret: {{ .Values.apis.plaid.secret | b64enc }}
     {{- end }}
   ```

5. **Network Policies:**
   ```yaml
   # templates/networkpolicy.yaml
   {{- if .Values.networkPolicy.enabled }}
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
   spec:
     podSelector:
       matchLabels:
         {{- include "networth-dashboard.selectorLabels" . | nindent 6 }}
     policyTypes:
     - Ingress
     - Egress
     ingress:
     - from:
       - namespaceSelector:
           matchLabels:
             name: ingress-nginx
       ports:
       - protocol: TCP
         port: 8080
     - from:
       - podSelector:
           matchLabels:
             {{- include "networth-dashboard.selectorLabels" . | nindent 10 }}
       ports:
       - protocol: TCP
         port: 8080
     egress:
     - to:
       - podSelector:
           matchLabels:
             app.kubernetes.io/name: postgresql
       ports:
       - protocol: TCP
         port: 5432
     - to:
       - podSelector:
           matchLabels:
             app.kubernetes.io/name: redis
       ports:
       - protocol: TCP
         port: 6379
     - to: []
       ports:
       - protocol: TCP
         port: 443
       - protocol: TCP
         port: 80
   {{- end }}
   ```

**Production Deployment Features:**

1. **High Availability Configuration:**
   ```yaml
   # templates/hpa.yaml
   {{- if .Values.backend.autoscaling.enabled }}
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}-backend
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: {{ include "networth-dashboard.fullname" . }}-backend
     minReplicas: {{ .Values.backend.autoscaling.minReplicas }}
     maxReplicas: {{ .Values.backend.autoscaling.maxReplicas }}
     metrics:
     {{- if .Values.backend.autoscaling.targetCPUUtilizationPercentage }}
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: {{ .Values.backend.autoscaling.targetCPUUtilizationPercentage }}
     {{- end }}
     {{- if .Values.backend.autoscaling.targetMemoryUtilizationPercentage }}
     - type: Resource
       resource:
         name: memory
         target:
           type: Utilization
           averageUtilization: {{ .Values.backend.autoscaling.targetMemoryUtilizationPercentage }}
     {{- end }}
   {{- end }}
   ```

2. **Pod Disruption Budget:**
   ```yaml
   # templates/pdb.yaml
   apiVersion: policy/v1
   kind: PodDisruptionBudget
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}-backend
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
   spec:
     minAvailable: {{ .Values.backend.pdb.minAvailable | default 1 }}
     selector:
       matchLabels:
         {{- include "networth-dashboard.selectorLabels" . | nindent 6 }}
         app.kubernetes.io/component: backend
   ```

3. **Monitoring & Observability:**
   ```yaml
   # templates/servicemonitor.yaml
   {{- if and .Values.monitoring.enabled .Values.monitoring.serviceMonitor.enabled }}
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: {{ include "networth-dashboard.fullname" . }}
     labels:
       {{- include "networth-dashboard.labels" . | nindent 4 }}
   spec:
     selector:
       matchLabels:
         {{- include "networth-dashboard.selectorLabels" . | nindent 6 }}
     endpoints:
     - port: metrics
       path: /metrics
       interval: {{ .Values.monitoring.serviceMonitor.interval }}
   {{- end }}
   ```

**Local Development with Podman:**

1. **Podman Compose Configuration:**
   ```yaml
   # docker-compose.dev.yml
   version: '3.8'
   
   services:
     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile.dev
       ports:
         - "8080:8080"
         - "9090:9090"  # metrics
       environment:
         - DATABASE_URL=postgresql://networth:password@postgres:5432/networth_db
         - REDIS_URL=redis://:password@redis:6379
         - JWT_SECRET=dev-jwt-secret-change-in-production
         - ENCRYPTION_KEY=dev-encryption-key-32-chars-long
         - LOG_LEVEL=debug
         - CORS_ORIGINS=http://localhost:3000
       volumes:
         - ./backend:/app
         - backend_tmp:/tmp
       depends_on:
         - postgres
         - redis
       networks:
         - networth-network
   
     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile.dev
       ports:
         - "3000:3000"
       environment:
         - REACT_APP_API_URL=http://localhost:8080
         - REACT_APP_WS_URL=ws://localhost:8080/ws
       volumes:
         - ./frontend:/app
         - /app/node_modules
       networks:
         - networth-network
   
     postgres:
       image: postgres:15-alpine
       environment:
         - POSTGRES_DB=networth_db
         - POSTGRES_USER=networth
         - POSTGRES_PASSWORD=password
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
         - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
       networks:
         - networth-network
   
     redis:
       image: redis:7-alpine
       command: redis-server --requirepass password
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
       networks:
         - networth-network
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx/nginx.conf:/etc/nginx/nginx.conf
         - ./nginx/ssl:/etc/nginx/ssl
       depends_on:
         - frontend
         - backend
       networks:
         - networth-network
   
   volumes:
     postgres_data:
     redis_data:
     backend_tmp:
   
   networks:
     networth-network:
       driver: bridge
   ```

2. **Development Scripts:**
   ```bash
   #!/bin/bash
   # scripts/dev-setup.sh
   
   set -e
   
   echo "Setting up Net Worth Dashboard for local development..."
   
   # Check if podman is installed
   if ! command -v podman &> /dev/null; then
       echo "Podman is not installed. Please install podman first."
       exit 1
   fi
   
   # Check if podman-compose is installed
   if ! command -v podman-compose &> /dev/null; then
       echo "Installing podman-compose..."
       pip3 install podman-compose
   fi
   
   # Create .env file if it doesn't exist
   if [ ! -f .env ]; then
       echo "Creating .env file..."
       cp .env.example .env
       echo "Please edit .env file with your API credentials"
   fi
   
   # Build and start services
   echo "Building and starting services..."
   podman-compose -f docker-compose.dev.yml up --build -d
   
   # Wait for database to be ready
   echo "Waiting for database to be ready..."
   sleep 10
   
   # Run database migrations
   echo "Running database migrations..."
   podman-compose -f docker-compose.dev.yml exec backend /app/migrate
   
   # Run initial data seeding
   echo "Seeding initial data..."
   podman-compose -f docker-compose.dev.yml exec backend /app/seed
   
   echo "Development environment is ready!"
   echo "Frontend: http://localhost:3000"
   echo "Backend API: http://localhost:8080"
   echo "Database: localhost:5432"
   echo "Redis: localhost:6379"
   ```

3. **Development Dockerfile:**
   ```dockerfile
   # backend/Dockerfile.dev
   FROM golang:1.21-alpine AS dev
   
   RUN apk add --no-cache git ca-certificates tzdata
   
   WORKDIR /app
   
   # Install air for hot reloading
   RUN go install github.com/cosmtrek/air@latest
   
   # Copy go mod files
   COPY go.mod go.sum ./
   RUN go mod download
   
   # Copy source code
   COPY . .
   
   # Build the binary
   RUN go build -o main .
   
   EXPOSE 8080 9090
   
   # Use air for hot reloading in development
   CMD ["air", "-c", ".air.toml"]
   ```

**Production Optimization:**

1. **Multi-stage Production Dockerfile:**
   ```dockerfile
   # backend/Dockerfile
   FROM golang:1.21-alpine AS builder
   
   RUN apk add --no-cache git ca-certificates tzdata
   
   WORKDIR /app
   
   # Copy go mod files
   COPY go.mod go.sum ./
   RUN go mod download
   
   # Copy source code
   COPY . .
   
   # Build the binary
   RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .
   
   # Final stage
   FROM alpine:latest
   
   RUN apk --no-cache add ca-certificates tzdata
   
   WORKDIR /root/
   
   # Copy the binary from builder stage
   COPY --from=builder /app/main .
   COPY --from=builder /app/config ./config
   COPY --from=builder /app/migrations ./migrations
   
   # Create non-root user
   RUN adduser -D -s /bin/sh networth
   USER networth
   
   EXPOSE 8080 9090
   
   CMD ["./main"]
   ```

**Deployment Commands & Workflows:**

1. **Helm Installation Commands:**
   ```bash
   # Install with custom values
   helm install networth-dashboard ./helm/networth-dashboard \
     --namespace networth \
     --create-namespace \
     --values values.prod.yaml
   
   # Upgrade deployment
   helm upgrade networth-dashboard ./helm/networth-dashboard \
     --namespace networth \
     --values values.prod.yaml
   
   # Rollback if needed
   helm rollback networth-dashboard 1 --namespace networth
   ```

2. **CI/CD Pipeline Integration:**
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Kubernetes
   
   on:
     push:
       branches: [main]
       tags: ['v*']
   
   jobs:
     build-and-deploy:
       runs-on: ubuntu-latest
       steps:
       - uses: actions/checkout@v3
       
       - name: Set up Docker Buildx
         uses: docker/setup-buildx-action@v2
       
       - name: Login to Container Registry
         uses: docker/login-action@v2
         with:
           registry: ghcr.io
           username: ${{ github.actor }}
           password: ${{ secrets.GITHUB_TOKEN }}
       
       - name: Build and push images
         uses: docker/build-push-action@v4
         with:
           context: .
           push: true
           tags: |
             ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
             ghcr.io/${{ github.repository }}/backend:latest
       
       - name: Set up Helm
         uses: azure/setup-helm@v3
         with:
           version: '3.12.0'
       
       - name: Deploy to Kubernetes
         run: |
           helm upgrade --install networth-dashboard ./helm/networth-dashboard \
             --namespace networth \
             --create-namespace \
             --set backend.image.tag=${{ github.sha }} \
             --set frontend.image.tag=${{ github.sha }} \
             --values values.prod.yaml
   ```

**Deliverables:**
1. Complete Helm chart with all Kubernetes resources
2. Production-ready values.yaml with security configurations
3. Development environment setup with Podman/Docker Compose
4. Security configurations including NetworkPolicies and PodSecurityPolicies
5. Monitoring and observability setup with Prometheus/Grafana
6. Backup and disaster recovery configurations
7. CI/CD pipeline templates for automated deployment
8. Health checks and readiness probes
9. Resource management and autoscaling configurations
10. Documentation for deployment and maintenance
11. Troubleshooting guides and runbooks
12. Performance testing and load testing configurations

Focus on creating a production-ready deployment that follows Kubernetes best practices, implements proper security measures, and provides excellent observability and maintainability.
```

### Prompt 5.2: Security, Monitoring & Production Hardening

```
Implement comprehensive security hardening, monitoring, and production-ready features for the Net Worth Dashboard:

**Security Hardening Requirements:**

1. **Application Security:**
   ```go
   // Security middleware implementation
   package security
   
   import (
       "context"
       "crypto/subtle"
       "fmt"
       "net/http"
       "strings"
       "time"
       
       "github.com/gin-gonic/gin"
       "golang.org/x/time/rate"
   )
   
   type SecurityMiddleware struct {
       jwtSecret    string
       rateLimiter  *rate.Limiter
       trustedIPs   []string
       corsOrigins  []string
   }
   
   func NewSecurityMiddleware(config SecurityConfig) *SecurityMiddleware {
       return &SecurityMiddleware{
           jwtSecret:   config.JWTSecret,
           rateLimiter: rate.NewLimiter(rate.Every(time.Minute), config.RateLimit),
           trustedIPs:  config.TrustedIPs,
           corsOrigins: config.CORSOrigins,
       }
   }
   
   func (s *SecurityMiddleware) RateLimit() gin.HandlerFunc {
       return func(c *gin.Context) {
           if !s.rateLimiter.Allow() {
               c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
               c.Abort()
               return
           }
           c.Next()
       }
   }
   
   func (s *SecurityMiddleware) CORS() gin.HandlerFunc {
       return func(c *gin.Context) {
           origin := c.Request.Header.Get("Origin")
           
           // Check if origin is allowed
           allowed := false
           for _, allowedOrigin := range s.corsOrigins {
               if origin == allowedOrigin {
                   allowed = true
                   break
               }
           }
           
           if allowed {
               c.Header("Access-Control-Allow-Origin", origin)
               c.Header("Access-Control-Allow-Credentials", "true")
               c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
               c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
           }
           
           if c.Request.Method == "OPTIONS" {
               c.AbortWithStatus(204)
               return
           }
           
           c.Next()
       }
   }
   
   func (s *SecurityMiddleware) SecurityHeaders() gin.HandlerFunc {
       return func(c *gin.Context) {
           c.Header("X-Frame-Options", "DENY")
           c.Header("X-Content-Type-Options", "nosniff")
           c.Header("X-XSS-Protection", "1; mode=block")
           c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
           c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'")
           c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
           c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
           c.Next()
       }
   }
   ```

2. **Credential Encryption Service:**
   ```go
   package encryption
   
   import (
       "crypto/aes"
       "crypto/cipher"
       "crypto/rand"
       "crypto/sha256"
       "encoding/base64"
       "errors"
       "fmt"
       
       "golang.org/x/crypto/pbkdf2"
   )
   
   type EncryptionService struct {
       masterKey []byte
   }
   
   func NewEncryptionService(masterKey string) *EncryptionService {
       key := pbkdf2.Key([]byte(masterKey), []byte("networth-salt"), 4096, 32, sha256.New)
       return &EncryptionService{
           masterKey: key,
       }
   }
   
   func (e *EncryptionService) Encrypt(plaintext string) (string, error) {
       block, err := aes.NewCipher(e.masterKey)
       if err != nil {
           return "", err
       }
       
       plainBytes := []byte(plaintext)
       ciphertext := make([]byte, aes.BlockSize+len(plainBytes))
       iv := ciphertext[:aes.BlockSize]
       
       if _, err := rand.Read(iv); err != nil {
           return "", err
       }
       
       stream := cipher.NewCFBEncrypter(block, iv)
       stream.XORKeyStream(ciphertext[aes.BlockSize:], plainBytes)
       
       return base64.StdEncoding.EncodeToString(ciphertext), nil
   }
   
   func (e *EncryptionService) Decrypt(ciphertext string) (string, error) {
       cipherBytes, err := base64.StdEncoding.DecodeString(ciphertext)
       if err != nil {
           return "", err
       }
       
       if len(cipherBytes) < aes.BlockSize {
           return "", errors.New("ciphertext too short")
       }
       
       block, err := aes.NewCipher(e.masterKey)
       if err != nil {
           return "", err
       }
       
       iv := cipherBytes[:aes.BlockSize]
       cipherBytes = cipherBytes[aes.BlockSize:]
       
       stream := cipher.NewCFBDecrypter(block, iv)
       stream.XORKeyStream(cipherBytes, cipherBytes)
       
       return string(cipherBytes), nil
   }
   ```

3. **Audit Logging System:**
   ```go
   package audit
   
   import (
       "context"
       "encoding/json"
       "time"
       
       "github.com/sirupsen/logrus"
   )
   
   type AuditLogger struct {
       logger *logrus.Logger
       db     AuditRepository
   }
   
   type AuditEvent struct {
       ID          string                 `json:"id"`
       UserID      string                 `json:"user_id"`
       Action      string                 `json:"action"`
       Resource    string                 `json:"resource"`
       ResourceID  string                 `json:"resource_id,omitempty"`
       Details     map[string]interface{} `json:"details,omitempty"`
       IPAddress   string                 `json:"ip_address"`
       UserAgent   string                 `json:"user_agent"`
       Timestamp   time.Time              `json:"timestamp"`
       Success     bool                   `json:"success"`
       ErrorReason string                 `json:"error_reason,omitempty"`
   }
   
   func (a *AuditLogger) LogEvent(ctx context.Context, event AuditEvent) error {
       event.Timestamp = time.Now()
       
       // Log to structured logger
       a.logger.WithFields(logrus.Fields{
           "audit_event": true,
           "user_id":     event.UserID,
           "action":      event.Action,
           "resource":    event.Resource,
           "success":     event.Success,
       }).Info("Audit event")
       
       // Store in database for compliance
       return a.db.StoreAuditEvent(ctx, event)
   }
   
   func (a *AuditLogger) LogCredentialAccess(ctx context.Context, userID, service string, success bool) error {
       return a.LogEvent(ctx, AuditEvent{
           UserID:   userID,
           Action:   "credential_access",
           Resource: "credentials",
           Details: map[string]interface{}{
               "service": service,
           },
           Success: success,
       })
   }
   ```

**Comprehensive Monitoring Setup:**

1. **Application Metrics:**
   ```go
   package metrics
   
   import (
       "github.com/prometheus/client_golang/prometheus"
       "github.com/prometheus/client_golang/prometheus/promauto"
   )
   
   var (
       // API Metrics
       apiRequestsTotal = promauto.NewCounterVec(
           prometheus.CounterOpts{
               Name: "networth_api_requests_total",
               Help: "Total number of API requests",
           },
           []string{"method", "endpoint", "status_code"},
       )
       
       apiRequestDuration = promauto.NewHistogramVec(
           prometheus.HistogramOpts{
               Name:    "networth_api_request_duration_seconds",
               Help:    "API request duration in seconds",
               Buckets: prometheus.DefBuckets,
           },
           []string{"method", "endpoint"},
       )
       
       // Plugin Metrics
       pluginSyncDuration = promauto.NewHistogramVec(
           prometheus.HistogramOpts{
               Name:    "networth_plugin_sync_duration_seconds",
               Help:    "Plugin synchronization duration in seconds",
               Buckets: []float64{.1, .25, .5, 1, 2.5, 5, 10, 30, 60},
           },
           []string{"plugin_name", "status"},
       )
       
       pluginSyncErrors = promauto.NewCounterVec(
           prometheus.CounterOpts{
               Name: "networth_plugin_sync_errors_total",
               Help: "Total number of plugin synchronization errors",
           },
           []string{"plugin_name", "error_type"},
       )
       
       // Financial Metrics
       totalNetWorth = promauto.NewGaugeVec(
           prometheus.GaugeOpts{
               Name: "networth_total_value_usd",
               Help: "Current total net worth in USD",
           },
           []string{"user_id"},
       )
       
       accountBalances = promauto.NewGaugeVec(
           prometheus.GaugeOpts{
               Name: "networth_account_balance_usd",
               Help: "Current account balance in USD",
           },
           []string{"user_id", "account_type", "institution"},
       )
       
       // System Metrics
       databaseConnections = promauto.NewGauge(
           prometheus.GaugeOpts{
               Name: "networth_database_connections_active",
               Help: "Number of active database connections",
           },
       )
       
       redisConnections = promauto.NewGauge(
           prometheus.GaugeOpts{
               Name: "networth_redis_connections_active",
               Help: "Number of active Redis connections",
           },
       )
   )
   
   type MetricsCollector struct {
       db    *sql.DB
       redis *redis.Client
   }
   
   func (m *MetricsCollector) CollectSystemMetrics() {
       // Database connection metrics
       stats := m.db.Stats()
       databaseConnections.Set(float64(stats.OpenConnections))
       
       // Redis connection metrics
       poolStats := m.redis.PoolStats()
       redisConnections.Set(float64(poolStats.TotalConns))
   }
   
   func (m *MetricsCollector) RecordAPIRequest(method, endpoint, statusCode string, duration float64) {
       apiRequestsTotal.WithLabelValues(method, endpoint, statusCode).Inc()
       apiRequestDuration.WithLabelValues(method, endpoint).Observe(duration)
   }
   
   func (m *MetricsCollector) RecordPluginSync(pluginName, status string, duration float64) {
       pluginSyncDuration.WithLabelValues(pluginName, status).Observe(duration)
   }
   
   func (m *MetricsCollector) RecordPluginError(pluginName, errorType string) {
       pluginSyncErrors.WithLabelValues(pluginName, errorType).Inc()
   }
   
   func (m *MetricsCollector) UpdateNetWorth(userID string, netWorth float64) {
       totalNetWorth.WithLabelValues(userID).Set(netWorth)
   }
   ```

2. **Health Check System:**
   ```go
   package health
   
   import (
       "context"
       "database/sql"
       "encoding/json"
       "net/http"
       "time"
       
       "github.com/gin-gonic/gin"
       "github.com/go-redis/redis/v8"
   )
   
   type HealthChecker struct {
       db     *sql.DB
       redis  *redis.Client
       checks map[string]HealthCheck
   }
   
   type HealthCheck interface {
       Name() string
       Check(ctx context.Context) error
   }
   
   type HealthStatus struct {
       Status    string                 `json:"status"`
       Timestamp time.Time              `json:"timestamp"`
       Checks    map[string]CheckResult `json:"checks"`
       Version   string                 `json:"version"`
       Uptime    time.Duration          `json:"uptime"`
   }
   
   type CheckResult struct {
       Status  string        `json:"status"`
       Message string        `json:"message,omitempty"`
       Latency time.Duration `json:"latency"`
   }
   
   func NewHealthChecker(db *sql.DB, redis *redis.Client) *HealthChecker {
       hc := &HealthChecker{
           db:     db,
           redis:  redis,
           checks: make(map[string]HealthCheck),
       }
       
       hc.RegisterCheck(&DatabaseCheck{db: db})
       hc.RegisterCheck(&RedisCheck{client: redis})
       hc.RegisterCheck(&DiskSpaceCheck{})
       hc.RegisterCheck(&MemoryCheck{})
       
       return hc
   }
   
   func (h *HealthChecker) RegisterCheck(check HealthCheck) {
       h.checks[check.Name()] = check
   }
   
   func (h *HealthChecker) HealthHandler() gin.HandlerFunc {
       return func(c *gin.Context) {
           ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
           defer cancel()
           
           status := h.RunChecks(ctx)
           
           if status.Status == "healthy" {
               c.JSON(http.StatusOK, status)
           } else {
               c.JSON(http.StatusServiceUnavailable, status)
           }
       }
   }
   
   func (h *HealthChecker) ReadinessHandler() gin.HandlerFunc {
       return func(c *gin.Context) {
           ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
           defer cancel()
           
           // Quick checks for readiness
           if err := h.checks["database"].Check(ctx); err != nil {
               c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not ready", "reason": "database"})
               return
           }
           
           c.JSON(http.StatusOK, gin.H{"status": "ready"})
       }
   }
   
   func (h *HealthChecker) RunChecks(ctx context.Context) HealthStatus {
       results := make(map[string]CheckResult)
       overallStatus := "healthy"
       
       for name, check := range h.checks {
           start := time.Now()
           err := check.Check(ctx)
           latency := time.Since(start)
           
           if err != nil {
               results[name] = CheckResult{
                   Status:  "unhealthy",
                   Message: err.Error(),
                   Latency: latency,
               }
               overallStatus = "unhealthy"
           } else {
               results[name] = CheckResult{
                   Status:  "healthy",
                   Latency: latency,
               }
           }
       }
       
       return HealthStatus{
           Status:    overallStatus,
           Timestamp: time.Now(),
           Checks:    results,
           Version:   GetVersion(),
           Uptime:    GetUptime(),
       }
   }
   
   // Individual health checks
   type DatabaseCheck struct {
       db *sql.DB
   }
   
   func (d *DatabaseCheck) Name() string { return "database" }
   func (d *DatabaseCheck) Check(ctx context.Context) error {
       return d.db.PingContext(ctx)
   }
   
   type RedisCheck struct {
       client *redis.Client
   }
   
   func (r *RedisCheck) Name() string { return "redis" }
   func (r *RedisCheck) Check(ctx context.Context) error {
       return r.client.Ping(ctx).Err()
   }
   ```

3. **Structured Logging:**
   ```go
   package logging
   
   import (
       "context"
       "os"
       "time"
       
       "github.com/sirupsen/logrus"
       "github.com/gin-gonic/gin"
   )
   
   type Logger struct {
       *logrus.Logger
   }
   
   func NewLogger(level string, format string) *Logger {
       logger := logrus.New()
       
       // Set log level
       lvl, err := logrus.ParseLevel(level)
       if err != nil {
           lvl = logrus.InfoLevel
       }
       logger.SetLevel(lvl)
       
       // Set formatter
       if format == "json" {
           logger.SetFormatter(&logrus.JSONFormatter{
               TimestampFormat: time.RFC3339,
               FieldMap: logrus.FieldMap{
                   logrus.FieldKeyTime:  "timestamp",
                   logrus.FieldKeyLevel: "level",
                   logrus.FieldKeyMsg:   "message",
               },
           })
       } else {
           logger.SetFormatter(&logrus.TextFormatter{
               FullTimestamp: true,
           })
       }
       
       logger.SetOutput(os.Stdout)
       
       return &Logger{Logger: logger}
   }
   
   func (l *Logger) GinMiddleware() gin.HandlerFunc {
       return func(c *gin.Context) {
           start := time.Now()
           
           c.Next()
           
           latency := time.Since(start)
           
           l.WithFields(logrus.Fields{
               "method":     c.Request.Method,
               "path":       c.Request.URL.Path,
               "status":     c.Writer.Status(),
               "latency":    latency,
               "client_ip":  c.ClientIP(),
               "user_agent": c.Request.UserAgent(),
           }).Info("HTTP request")
       }
   }
   
   func (l *Logger) WithContext(ctx context.Context) *logrus.Entry {
       entry := l.WithFields(logrus.Fields{})
       
       if requestID := ctx.Value("request_id"); requestID != nil {
           entry = entry.WithField("request_id", requestID)
       }
       
       if userID := ctx.Value("user_id"); userID != nil {
           entry = entry.WithField("user_id", userID)
       }
       
       return entry
   }
   ```

**Production Monitoring Dashboard:**

1. **Grafana Dashboard Configuration:**
   ```json
   {
     "dashboard": {
       "title": "Net Worth Dashboard - Application Metrics",
       "tags": ["networth", "application"],
       "timezone": "browser",
       "panels": [
         {
           "title": "API Request Rate",
           "type": "graph",
           "targets": [
             {
               "expr": "rate(networth_api_requests_total[5m])",
               "legendFormat": "{{method}} {{endpoint}}"
             }
           ],
           "yAxes": [
             {
               "label": "Requests/sec"
             }
           ]
         },
         {
           "title": "API Response Time",
           "type": "graph",
           "targets": [
             {
               "expr": "histogram_quantile(0.95, rate(networth_api_request_duration_seconds_bucket[5m]))",
               "legendFormat": "95th percentile"
             },
             {
               "expr": "histogram_quantile(0.50, rate(networth_api_request_duration_seconds_bucket[5m]))",
               "legendFormat": "50th percentile"
             }
           ]
         },
         {
           "title": "Plugin Sync Status",
           "type": "table",
           "targets": [
             {
               "expr": "networth_plugin_sync_duration_seconds",
               "format": "table"
             }
           ]
         },
         {
           "title": "Error Rate",
           "type": "stat",
           "targets": [
             {
               "expr": "rate(networth_api_requests_total{status_code=~\"5..\"}[5m])",
               "legendFormat": "5xx errors/sec"
             }
           ],
           "thresholds": [
             {
               "color": "green",
               "value": 0
             },
             {
               "color": "red",
               "value": 0.1
             }
           ]
         },
         {
           "title": "Active Users",
           "type": "stat",
           "targets": [
             {
               "expr": "count(increase(networth_api_requests_total{endpoint=\"/api/auth/login\"}[1h]))",
               "legendFormat": "Active users (last hour)"
             }
           ]
         },
         {
           "title": "Database Connections",
           "type": "graph",
           "targets": [
             {
               "expr": "networth_database_connections_active",
               "legendFormat": "Active connections"
             }
           ]
         }
       ],
       "time": {
         "from": "now-6h",
         "to": "now"
       },
       "refresh": "30s"
     }
   }
   ```

2. **Alerting Rules:**
   ```yaml
   # alerts/application.yml
   groups:
   - name: networth-application
     rules:
     - alert: HighErrorRate
       expr: rate(networth_api_requests_total{status_code=~"5.."}[5m]) > 0.1
       for: 2m
       labels:
         severity: critical
       annotations:
         summary: "High error rate detected"
         description: "Error rate is above 10% for the last 5 minutes"
   
     - alert: HighResponseTime
       expr: histogram_quantile(0.95, rate(networth_api_request_duration_seconds_bucket[5m])) > 2
       for: 5m
       labels:
         severity: warning
       annotations:
         summary: "High response time detected"
         description: "95th percentile response time is above 2 seconds"
   
     - alert: PluginSyncFailure
       expr: increase(networth_plugin_sync_errors_total[10m]) > 5
       for: 0m
       labels:
         severity: warning
       annotations:
         summary: "Plugin sync failures detected"
         description: "Plugin {{ $labels.plugin_name }} has failed to sync multiple times"
   
     - alert: DatabaseConnectionsHigh
       expr: networth_database_connections_active > 15
       for: 5m
       labels:
         severity: warning
       annotations:
         summary: "High database connection usage"
         description: "Database connection pool is at {{ $value }} connections"
   
     - alert: ApplicationDown
       expr: up{job="networth-backend"} == 0
       for: 1m
       labels:
         severity: critical
       annotations:
         summary: "Application is down"
         description: "Net Worth Dashboard backend is not responding"
   ```

**Security Scanning & Compliance:**

1. **Container Security Scanning:**
   ```dockerfile
   # .docker/security/Dockerfile.security-scan
   FROM aquasec/trivy:latest
   
   COPY . /app
   WORKDIR /app
   
   # Scan the built images
   RUN trivy image --exit-code 1 --severity HIGH,CRITICAL networth-backend:latest
   RUN trivy image --exit-code 1 --severity HIGH,CRITICAL networth-frontend:latest
   
   # Scan for secrets
   RUN trivy fs --exit-code 1 --security-checks secret .
   
   # Generate SBOM (Software Bill of Materials)
   RUN trivy image --format spdx-json --output sbom.json networth-backend:latest
   ```

2. **Security Policy as Code:**
   ```yaml
   # security/pod-security-policy.yaml
   apiVersion: policy/v1beta1
   kind: PodSecurityPolicy
   metadata:
     name: networth-psp
   spec:
     privileged: false
     allowPrivilegeEscalation: false
     requiredDropCapabilities:
       - ALL
     volumes:
       - 'configMap'
       - 'emptyDir'
       - 'projected'
       - 'secret'
       - 'downwardAPI'
       - 'persistentVolumeClaim'
     hostNetwork: false
     hostIPC: false
     hostPID: false
     runAsUser:
       rule: 'MustRunAsNonRoot'
     supplementalGroups:
       rule: 'MustRunAs'
       ranges:
         - min: 1
           max: 65535
     fsGroup:
       rule: 'MustRunAs'
       ranges:
         - min: 1
           max: 65535
     readOnlyRootFilesystem: true
   ```

3. **Compliance Monitoring:**
   ```go
   package compliance
   
   import (
       "context"
       "fmt"
       "time"
   )
   
   type ComplianceChecker struct {
       auditLogger *AuditLogger
       rules       []ComplianceRule
   }
   
   type ComplianceRule interface {
       Name() string
       Check(ctx context.Context) (*ComplianceResult, error)
       Category() string
       Severity() string
   }
   
   type ComplianceResult struct {
       RuleName    string    `json:"rule_name"`
       Status      string    `json:"status"` // "pass", "fail", "warning"
       Details     string    `json:"details"`
       Evidence    []string  `json:"evidence,omitempty"`
       Timestamp   time.Time `json:"timestamp"`
       Remediation string    `json:"remediation,omitempty"`
   }
   
   // PCI DSS Compliance Rules
   type EncryptionAtRestRule struct{}
   
   func (e *EncryptionAtRestRule) Name() string     { return "encryption_at_rest" }
   func (e *EncryptionAtRestRule) Category() string { return "PCI DSS" }
   func (e *EncryptionAtRestRule) Severity() string { return "high" }
   
   func (e *EncryptionAtRestRule) Check(ctx context.Context) (*ComplianceResult, error) {
       // Check database encryption
       // Check file system encryption
       // Check backup encryption
       
       return &ComplianceResult{
           RuleName:  e.Name(),
           Status:    "pass",
           Details:   "All data at rest is encrypted using AES-256",
           Timestamp: time.Now(),
       }, nil
   }
   
   type AccessLoggingRule struct{}
   
   func (a *AccessLoggingRule) Name() string     { return "access_logging" }
   func (a *AccessLoggingRule) Category() string { return "SOX" }
   func (a *AccessLoggingRule) Severity() string { return "medium" }
   
   func (a *AccessLoggingRule) Check(ctx context.Context) (*ComplianceResult, error) {
       // Verify audit logs are being generated
       // Check log retention policies
       // Verify log integrity
       
       return &ComplianceResult{
           RuleName:  a.Name(),
           Status:    "pass",
           Details:   "Access logging is enabled and logs are retained for required period",
           Timestamp: time.Now(),
       }, nil
   }
   ```

**Backup & Disaster Recovery:**

1. **Automated Backup System:**
   ```bash
   #!/bin/bash
   # scripts/backup.sh
   
   set -e
   
   TIMESTAMP=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/backups"
   RETENTION_DAYS=30
   
   echo "Starting backup process at $(date)"
   
   # Database backup
   kubectl exec -n networth $(kubectl get pods -n networth -l app=postgresql -o jsonpath='{.items[0].metadata.name}') -- \
       pg_dump -U networth -d networth_db | gzip > "${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
   
   # Configuration backup
   kubectl get configmaps,secrets -n networth -o yaml > "${BACKUP_DIR}/config_backup_${TIMESTAMP}.yaml"
   
   # Application state backup
   kubectl exec -n networth $(kubectl get pods -n networth -l app=networth-backend -o jsonpath='{.items[0].metadata.name}') -- \
       tar -czf - /app/uploads | cat > "${BACKUP_DIR}/uploads_backup_${TIMESTAMP}.tar.gz"
   
   # Upload to cloud storage
   aws s3 cp "${BACKUP_DIR}/" s3://networth-backups/$(date +%Y/%m/%d)/ --recursive --include "*${TIMESTAMP}*"
   
   # Clean up old local backups
   find "${BACKUP_DIR}" -name "*.gz" -mtime +${RETENTION_DAYS} -delete
   find "${BACKUP_DIR}" -name "*.yaml" -mtime +${RETENTION_DAYS} -delete
   
   echo "Backup completed successfully at $(date)"
   ```

2. **Disaster Recovery Plan:**
   ```yaml
   # disaster-recovery/restore-procedure.yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: disaster-recovery-runbook
   data:
     restore-procedure.md: |
       # Disaster Recovery Procedure
       
       ## Prerequisites
       - Access to backup storage (S3)
       - Kubernetes cluster access
       - Helm installed
       
       ## Recovery Steps
       
       ### 1. Restore Database
       ```bash
       # Create new PostgreSQL instance
       helm install postgresql bitnami/postgresql -n networth
       
       # Restore from backup
       kubectl exec -i postgresql-0 -n networth -- psql -U postgres -d networth_db < backup.sql
       ```
       
       ### 2. Restore Application
       ```bash
       # Deploy application
       helm install networth-dashboard ./helm/networth-dashboard -n networth
       
       # Restore configuration
       kubectl apply -f config_backup.yaml
       ```
       
       ### 3. Verify Recovery
       ```bash
       # Check application health
       kubectl get pods -n networth
       curl https://networth.yourdomain.com/health
       
       # Verify data integrity
       kubectl exec deployment/networth-backend -n networth -- ./verify-data
       ```
       
       ## Recovery Time Objectives
       - RTO (Recovery Time Objective): 4 hours
       - RPO (Recovery Point Objective): 24 hours
   ```

**Performance Optimization:**

1. **Database Performance Monitoring:**
   ```sql
   -- Database performance queries
   CREATE OR REPLACE VIEW performance_metrics AS
   SELECT 
       schemaname,
       tablename,
       attname,
       n_distinct,
       correlation,
       most_common_vals,
       most_common_freqs
   FROM pg_stats 
   WHERE schemaname = 'public';
   
   CREATE OR REPLACE VIEW slow_queries AS
   SELECT 
       query,
       calls,
       total_time,
       mean_time,
       stddev_time,
       rows
   FROM pg_stat_statements 
   WHERE mean_time > 1000
   ORDER BY mean_time DESC;
   ```

2. **Application Performance Tuning:**
   ```go
   package performance
   
   import (
       "context"
       "sync"
       "time"
   )
   
   type PerformanceOptimizer struct {
       cache       *Cache
       dbPool      *DatabasePool
       rateLimiter *RateLimiter
       metrics     *MetricsCollector
   }
   
   func (p *PerformanceOptimizer) OptimizeQuery(ctx context.Context, query string) (interface{}, error) {
       // Check cache first
       if cached := p.cache.Get(query); cached != nil {
           p.metrics.RecordCacheHit("query")
           return cached, nil
       }
       
       // Execute query with timeout
       ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
       defer cancel()
       
       result, err := p.dbPool.Query(ctx, query)
       if err != nil {
           return nil, err
       }
       
       // Cache result
       p.cache.Set(query, result, 5*time.Minute)
       p.metrics.RecordCacheMiss("query")
       
       return result, nil
   }
   
   func (p *PerformanceOptimizer) BatchProcess(items []interface{}, batchSize int) error {
       var wg sync.WaitGroup
       semaphore := make(chan struct{}, 10) // Limit concurrent goroutines
       
       for i := 0; i < len(items); i += batchSize {
           end := i + batchSize
           if end > len(items) {
               end = len(items)
           }
           
           wg.Add(1)
           go func(batch []interface{}) {
               defer wg.Done()
               semaphore <- struct{}{}
               defer func() { <-semaphore }()
               
               p.processBatch(batch)
           }(items[i:end])
       }
       
       wg.Wait()
       return nil
   }
   ```

**Deliverables:**
1. Complete security hardening with encryption, authentication, and authorization
2. Comprehensive monitoring with Prometheus metrics and Grafana dashboards
3. Structured logging with audit trails and compliance tracking
4. Health check system with readiness and liveness probes
5. Automated backup and disaster recovery procedures
6. Security scanning and vulnerability management
7. Performance optimization and tuning guidelines
8. Compliance monitoring and reporting
9. Production deployment runbooks and procedures
10. Incident response and troubleshooting guides
11. Load testing and capacity planning tools
12. Documentation for production operations and maintenance

Focus on creating a production-ready system that meets enterprise security standards, provides excellent observability, and can scale reliably under load while maintaining data integrity and user privacy.
```

---

## Summary

These comprehensive prompts will guide AI through building a professional-grade Net Worth Dashboard with:

**Phase 1**: Solid foundation with plugin architecture and secure credential management
**Phase 2**: Advanced manual entry system and stock consolidation capabilities  
**Phase 3**: API integrations with major financial institutions
**Phase 4**: Professional analytics and interactive visualizations
**Phase 5**: Production deployment with security hardening and monitoring

Each prompt is designed to be self-contained yet builds upon previous phases, ensuring the AI has enough context to make good architectural decisions while delivering incremental, testable functionality at each stage.