package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
)

// ScenarioService handles what-if scenario calculations and management
type ScenarioService struct {
	db            *sql.DB
	cryptoService *CryptoService
}

// NewScenarioService creates a new scenario service
func NewScenarioService(db *sql.DB, cryptoService *CryptoService) *ScenarioService {
	return &ScenarioService{
		db:            db,
		cryptoService: cryptoService,
	}
}

// Scenario represents a what-if scenario configuration
type Scenario struct {
	ID                          int       `json:"id"`
	Name                        string    `json:"name"`
	Description                 string    `json:"description"`
	TimeHorizonYears           int       `json:"time_horizon_years"`
	RebalancingFrequency       string    `json:"rebalancing_frequency"`
	BitcoinAllocationPercentage float64   `json:"bitcoin_allocation_percentage"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
	Parameters                 []ScenarioParameter      `json:"parameters,omitempty"`
	CryptoParameters           []CryptoScenarioParameter `json:"crypto_parameters,omitempty"`
	Results                    []ScenarioResult          `json:"results,omitempty"`
}

// ScenarioParameter represents expected returns for an asset class
type ScenarioParameter struct {
	ID                   int     `json:"id"`
	ScenarioID          int     `json:"scenario_id"`
	AssetClass          string  `json:"asset_class"`
	ExpectedAnnualReturn float64 `json:"expected_annual_return"`
	AnnualVolatility    float64 `json:"annual_volatility"`
	CustomParameters    map[string]interface{} `json:"custom_parameters,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

// CryptoScenarioParameter represents expected returns for a specific cryptocurrency
type CryptoScenarioParameter struct {
	ID                   int     `json:"id"`
	ScenarioID          int     `json:"scenario_id"`
	CryptoSymbol        string  `json:"crypto_symbol"`
	ExpectedAnnualReturn float64 `json:"expected_annual_return"`
	AnnualVolatility    float64 `json:"annual_volatility"`
	CustomParameters    map[string]interface{} `json:"custom_parameters,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

// ScenarioResult represents projected portfolio values for a specific year
type ScenarioResult struct {
	ID                   int     `json:"id"`
	ScenarioID          int     `json:"scenario_id"`
	ProjectionYear      int     `json:"projection_year"`
	TotalNetWorth       float64 `json:"total_net_worth"`
	NetWorthInBTC       float64 `json:"net_worth_in_btc"`
	ProjectedBitcoinPrice float64 `json:"projected_bitcoin_price"`
	StockValue          float64 `json:"stock_value"`
	CryptoValue         float64 `json:"crypto_value"`
	RealEstateValue     float64 `json:"real_estate_value"`
	CashValue           float64 `json:"cash_value"`
	OtherAssetsValue    float64 `json:"other_assets_value"`
	AssetAllocation     map[string]float64 `json:"asset_allocation"`
	CalculatedAt        time.Time `json:"calculated_at"`
}

// CurrentPortfolio represents the current state of all assets
type CurrentPortfolio struct {
	StockValue        float64 `json:"stock_value"`
	CryptoValue       float64 `json:"crypto_value"`
	RealEstateValue   float64 `json:"real_estate_value"`
	CashValue         float64 `json:"cash_value"`
	OtherAssetsValue  float64 `json:"other_assets_value"`
	TotalValue        float64 `json:"total_value"`
	CurrentBitcoinPrice float64 `json:"current_bitcoin_price"`
}

// DefaultParameters returns suggested default parameters for different asset classes
func (s *ScenarioService) GetDefaultParameters() map[string]ScenarioParameter {
	return map[string]ScenarioParameter{
		"stocks": {
			AssetClass:          "stocks",
			ExpectedAnnualReturn: 8.5,
			AnnualVolatility:    15.0,
			CustomParameters: map[string]interface{}{
				"description": "Diversified stock portfolio based on historical S&P 500 returns",
				"historical_range": "7-12%",
			},
		},
		"real_estate": {
			AssetClass:          "real_estate",
			ExpectedAnnualReturn: 4.0,
			AnnualVolatility:    8.0,
			CustomParameters: map[string]interface{}{
				"description": "Real estate appreciation including rental income",
				"historical_range": "3-6%",
			},
		},
		"cash": {
			AssetClass:          "cash",
			ExpectedAnnualReturn: 3.0,
			AnnualVolatility:    0.5,
			CustomParameters: map[string]interface{}{
				"description": "Cash accounts, CDs, and money market funds",
				"historical_range": "1-5%",
			},
		},
		"crypto": {
			AssetClass:          "crypto",
			ExpectedAnnualReturn: 20.0,
			AnnualVolatility:    60.0,
			CustomParameters: map[string]interface{}{
				"description": "Bitcoin and other cryptocurrency holdings",
				"historical_range": "15-25% (high volatility)",
			},
		},
		"other_assets": {
			AssetClass:          "other_assets",
			ExpectedAnnualReturn: 3.0,
			AnnualVolatility:    5.0,
			CustomParameters: map[string]interface{}{
				"description": "Miscellaneous assets and collectibles",
				"historical_range": "2-5%",
			},
		},
	}
}

// CreateScenario creates a new scenario with parameters
func (s *ScenarioService) CreateScenario(scenario *Scenario) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert scenario
	query := `
		INSERT INTO scenarios (name, description, time_horizon_years, rebalancing_frequency, bitcoin_allocation_percentage)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(query, scenario.Name, scenario.Description, scenario.TimeHorizonYears, 
		scenario.RebalancingFrequency, scenario.BitcoinAllocationPercentage).
		Scan(&scenario.ID, &scenario.CreatedAt, &scenario.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create scenario: %w", err)
	}

	// Insert parameters
	for _, param := range scenario.Parameters {
		customParamsJSON, _ := json.Marshal(param.CustomParameters)
		paramQuery := `
			INSERT INTO scenario_parameters (scenario_id, asset_class, expected_annual_return, annual_volatility, custom_parameters)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, created_at
		`
		err = tx.QueryRow(paramQuery, scenario.ID, param.AssetClass, param.ExpectedAnnualReturn, 
			param.AnnualVolatility, customParamsJSON).
			Scan(&param.ID, &param.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed to create scenario parameter: %w", err)
		}
	}

	// Insert crypto parameters
	for _, param := range scenario.CryptoParameters {
		customParamsJSON, _ := json.Marshal(param.CustomParameters)
		cryptoParamQuery := `
			INSERT INTO crypto_scenario_parameters (scenario_id, crypto_symbol, expected_annual_return, annual_volatility, custom_parameters)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, created_at
		`
		err = tx.QueryRow(cryptoParamQuery, scenario.ID, param.CryptoSymbol, param.ExpectedAnnualReturn, 
			param.AnnualVolatility, customParamsJSON).
			Scan(&param.ID, &param.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed to create crypto scenario parameter: %w", err)
		}
	}

	return tx.Commit()
}

// GetScenarios retrieves all scenarios
func (s *ScenarioService) GetScenarios() ([]Scenario, error) {
	query := `
		SELECT id, name, description, time_horizon_years, rebalancing_frequency, 
			   bitcoin_allocation_percentage, created_at, updated_at
		FROM scenarios
		ORDER BY created_at DESC
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch scenarios: %w", err)
	}
	defer rows.Close()

	var scenarios []Scenario
	for rows.Next() {
		var scenario Scenario
		err := rows.Scan(&scenario.ID, &scenario.Name, &scenario.Description, 
			&scenario.TimeHorizonYears, &scenario.RebalancingFrequency, 
			&scenario.BitcoinAllocationPercentage, &scenario.CreatedAt, &scenario.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan scenario: %w", err)
		}
		scenarios = append(scenarios, scenario)
	}

	return scenarios, nil
}

// GetScenario retrieves a specific scenario with its parameters
func (s *ScenarioService) GetScenario(id int) (*Scenario, error) {
	query := `
		SELECT id, name, description, time_horizon_years, rebalancing_frequency, 
			   bitcoin_allocation_percentage, created_at, updated_at
		FROM scenarios
		WHERE id = $1
	`
	var scenario Scenario
	err := s.db.QueryRow(query, id).Scan(&scenario.ID, &scenario.Name, &scenario.Description, 
		&scenario.TimeHorizonYears, &scenario.RebalancingFrequency, 
		&scenario.BitcoinAllocationPercentage, &scenario.CreatedAt, &scenario.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch scenario: %w", err)
	}

	// Get parameters
	paramQuery := `
		SELECT id, asset_class, expected_annual_return, annual_volatility, custom_parameters, created_at
		FROM scenario_parameters
		WHERE scenario_id = $1
		ORDER BY asset_class
	`
	paramRows, err := s.db.Query(paramQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch scenario parameters: %w", err)
	}
	defer paramRows.Close()

	var parameters []ScenarioParameter
	for paramRows.Next() {
		var param ScenarioParameter
		var customParamsJSON []byte
		err := paramRows.Scan(&param.ID, &param.AssetClass, &param.ExpectedAnnualReturn, 
			&param.AnnualVolatility, &customParamsJSON, &param.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan scenario parameter: %w", err)
		}
		
		if len(customParamsJSON) > 0 {
			json.Unmarshal(customParamsJSON, &param.CustomParameters)
		}
		
		param.ScenarioID = id
		parameters = append(parameters, param)
	}

	scenario.Parameters = parameters

	// Get crypto parameters
	cryptoParamQuery := `
		SELECT id, crypto_symbol, expected_annual_return, annual_volatility, custom_parameters, created_at
		FROM crypto_scenario_parameters
		WHERE scenario_id = $1
		ORDER BY crypto_symbol
	`
	cryptoParamRows, err := s.db.Query(cryptoParamQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch crypto scenario parameters: %w", err)
	}
	defer cryptoParamRows.Close()

	var cryptoParameters []CryptoScenarioParameter
	for cryptoParamRows.Next() {
		var param CryptoScenarioParameter
		var customParamsJSON []byte
		err := cryptoParamRows.Scan(&param.ID, &param.CryptoSymbol, &param.ExpectedAnnualReturn, 
			&param.AnnualVolatility, &customParamsJSON, &param.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan crypto scenario parameter: %w", err)
		}
		
		if len(customParamsJSON) > 0 {
			json.Unmarshal(customParamsJSON, &param.CustomParameters)
		}
		
		param.ScenarioID = id
		cryptoParameters = append(cryptoParameters, param)
	}

	scenario.CryptoParameters = cryptoParameters
	return &scenario, nil
}

// GetCurrentPortfolio retrieves current portfolio values
func (s *ScenarioService) GetCurrentPortfolio() (*CurrentPortfolio, error) {
	portfolio := &CurrentPortfolio{}

	// Get stock value
	stockQuery := `
		SELECT COALESCE(SUM(shares_owned * COALESCE(current_price, 0)), 0) 
		FROM stock_holdings
		WHERE current_price > 0 AND COALESCE(is_vested_equity, false) = false
	`
	err := s.db.QueryRow(stockQuery).Scan(&portfolio.StockValue)
	if err != nil {
		return nil, fmt.Errorf("failed to get stock value: %w", err)
	}

	// Get crypto holdings and calculate value using real-time prices
	cryptoHoldingsQuery := `
		SELECT crypto_symbol, balance_tokens 
		FROM crypto_holdings
	`
	cryptoRows, err := s.db.Query(cryptoHoldingsQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to get crypto holdings: %w", err)
	}
	defer cryptoRows.Close()

	portfolio.CryptoValue = 0
	fmt.Printf("DEBUG: Crypto Holdings Detail:\n")
	
	for cryptoRows.Next() {
		var symbol string
		var balance float64
		if err := cryptoRows.Scan(&symbol, &balance); err != nil {
			continue
		}
		
		// Get current price using crypto service
		var price float64
		if cryptoPrice, err := s.cryptoService.GetPrice(symbol); err == nil && cryptoPrice != nil {
			price = cryptoPrice.PriceUSD
		} else {
			// Fallback to database price
			priceQuery := `SELECT COALESCE(price_usd, 0) FROM crypto_prices WHERE symbol = $1 ORDER BY last_updated DESC LIMIT 1`
			s.db.QueryRow(priceQuery, symbol).Scan(&price)
		}
		
		value := balance * price
		portfolio.CryptoValue += value
		
		fmt.Printf("  %s: %.8f tokens × $%.2f = $%.2f\n", symbol, balance, price, value)
	}

	// Get real estate value
	realEstateQuery := `
		SELECT COALESCE(SUM(equity), 0) 
		FROM real_estate_properties
	`
	err = s.db.QueryRow(realEstateQuery).Scan(&portfolio.RealEstateValue)
	if err != nil {
		return nil, fmt.Errorf("failed to get real estate value: %w", err)
	}

	// Get cash value
	cashQuery := `
		SELECT COALESCE(SUM(current_balance), 0) 
		FROM cash_holdings
	`
	err = s.db.QueryRow(cashQuery).Scan(&portfolio.CashValue)
	if err != nil {
		return nil, fmt.Errorf("failed to get cash value: %w", err)
	}

	// Get other assets value
	otherQuery := `
		SELECT COALESCE(SUM(current_value - COALESCE(amount_owed, 0)), 0) 
		FROM miscellaneous_assets
	`
	err = s.db.QueryRow(otherQuery).Scan(&portfolio.OtherAssetsValue)
	if err != nil {
		return nil, fmt.Errorf("failed to get other assets value: %w", err)
	}

	// Get current Bitcoin price using the crypto service
	btcPrice, err := s.cryptoService.GetPrice("btc")
	if err != nil || btcPrice == nil {
		// Fallback to database
		btcQuery := `
			SELECT COALESCE(price_usd, 0) 
			FROM crypto_prices 
			WHERE symbol = 'bitcoin' 
			ORDER BY last_updated DESC 
			LIMIT 1
		`
		err = s.db.QueryRow(btcQuery).Scan(&portfolio.CurrentBitcoinPrice)
		if err != nil {
			portfolio.CurrentBitcoinPrice = 45000 // Default fallback
		}
	} else {
		portfolio.CurrentBitcoinPrice = btcPrice.PriceUSD
	}

	portfolio.TotalValue = portfolio.StockValue + portfolio.CryptoValue + 
		portfolio.RealEstateValue + portfolio.CashValue + portfolio.OtherAssetsValue

	return portfolio, nil
}

// CalculateScenario runs the scenario calculation and stores results
func (s *ScenarioService) CalculateScenario(scenarioID int) ([]ScenarioResult, error) {
	scenario, err := s.GetScenario(scenarioID)
	if err != nil {
		return nil, fmt.Errorf("failed to get scenario: %w", err)
	}

	portfolio, err := s.GetCurrentPortfolio()
	if err != nil {
		return nil, fmt.Errorf("failed to get current portfolio: %w", err)
	}
	
	// Debug: Log original portfolio values
	fmt.Printf("DEBUG: Original Portfolio - Stock: %.2f, Crypto: %.2f, Real Estate: %.2f, Cash: %.2f, Other: %.2f, Total: %.2f\n",
		portfolio.StockValue, portfolio.CryptoValue, portfolio.RealEstateValue, 
		portfolio.CashValue, portfolio.OtherAssetsValue, portfolio.TotalValue)

	// Clear existing results
	_, err = s.db.Exec("DELETE FROM scenario_results WHERE scenario_id = $1", scenarioID)
	if err != nil {
		return nil, fmt.Errorf("failed to clear existing results: %w", err)
	}

	// Calculate projections for each year
	results := make([]ScenarioResult, 0, scenario.TimeHorizonYears+1) // +1 for year 0
	
	// Keep original portfolio for Year 0, apply Bitcoin allocation only for projections
	originalPortfolio := *portfolio
	
	// Get return parameters by asset class
	paramMap := make(map[string]ScenarioParameter)
	for _, param := range scenario.Parameters {
		paramMap[param.AssetClass] = param
	}

	// Get crypto-specific parameters
	cryptoParamMap := make(map[string]CryptoScenarioParameter)
	for _, param := range scenario.CryptoParameters {
		cryptoParamMap[param.CryptoSymbol] = param
	}
	
	// Debug: Log current portfolio values and parameters
	fmt.Printf("DEBUG: Original Portfolio - Stock: %.2f, Crypto: %.2f, Real Estate: %.2f, Cash: %.2f, Other: %.2f\n",
		originalPortfolio.StockValue, originalPortfolio.CryptoValue, originalPortfolio.RealEstateValue, 
		originalPortfolio.CashValue, originalPortfolio.OtherAssetsValue)
	fmt.Printf("DEBUG: Bitcoin allocation: %.2f%%\n", scenario.BitcoinAllocationPercentage)
	for assetClass, param := range paramMap {
		fmt.Printf("DEBUG: %s return rate: %.2f%%\n", assetClass, param.ExpectedAnnualReturn)
	}

	// Add Year 0 (current baseline) - use original portfolio values, no allocation adjustment
	year0Result := ScenarioResult{
		ScenarioID:            scenarioID,
		ProjectionYear:        0,
		CalculatedAt:          time.Now(),
		StockValue:           originalPortfolio.StockValue,
		CryptoValue:          originalPortfolio.CryptoValue,
		RealEstateValue:      originalPortfolio.RealEstateValue,
		CashValue:            originalPortfolio.CashValue,
		OtherAssetsValue:     originalPortfolio.OtherAssetsValue,
		TotalNetWorth:        originalPortfolio.TotalValue,
		ProjectedBitcoinPrice: portfolio.CurrentBitcoinPrice,
	}
	
	if year0Result.ProjectedBitcoinPrice > 0 {
		year0Result.NetWorthInBTC = year0Result.TotalNetWorth / year0Result.ProjectedBitcoinPrice
	}
	
	// Calculate year 0 asset allocation
	if year0Result.TotalNetWorth > 0 {
		year0Result.AssetAllocation = map[string]float64{
			"stocks":       (year0Result.StockValue / year0Result.TotalNetWorth) * 100,
			"crypto":       (year0Result.CryptoValue / year0Result.TotalNetWorth) * 100,
			"real_estate":  (year0Result.RealEstateValue / year0Result.TotalNetWorth) * 100,
			"cash":         (year0Result.CashValue / year0Result.TotalNetWorth) * 100,
			"other_assets": (year0Result.OtherAssetsValue / year0Result.TotalNetWorth) * 100,
		}
	} else {
		year0Result.AssetAllocation = map[string]float64{
			"stocks": 0, "crypto": 0, "real_estate": 0, "cash": 0, "other_assets": 0,
		}
	}

	// Store year 0 result
	allocationJSON, _ := json.Marshal(year0Result.AssetAllocation)
	insertQuery := `
		INSERT INTO scenario_results (scenario_id, projection_year, total_net_worth, net_worth_in_btc, 
			projected_bitcoin_price, stock_value, crypto_value, real_estate_value, cash_value, 
			other_assets_value, asset_allocation)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, calculated_at
	`
	err = s.db.QueryRow(insertQuery, scenarioID, 0, year0Result.TotalNetWorth, year0Result.NetWorthInBTC,
		year0Result.ProjectedBitcoinPrice, year0Result.StockValue, year0Result.CryptoValue, year0Result.RealEstateValue,
		year0Result.CashValue, year0Result.OtherAssetsValue, allocationJSON).
		Scan(&year0Result.ID, &year0Result.CalculatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to store year 0 result: %w", err)
	}
	results = append(results, year0Result)

	// Apply Bitcoin allocation for future year calculations
	currentValues := s.applyBitcoinAllocation(&originalPortfolio, scenario.BitcoinAllocationPercentage)
	
	// Calculate future years (1 to TimeHorizonYears)
	for year := 1; year <= scenario.TimeHorizonYears; year++ {
		result := ScenarioResult{
			ScenarioID:     scenarioID,
			ProjectionYear: year,
			CalculatedAt:   time.Now(),
		}

		// Apply compound growth to each asset class (using Bitcoin-allocated values for projections)
		result.StockValue = currentValues.StockValue * math.Pow(1+paramMap["stocks"].ExpectedAnnualReturn/100, float64(year))
		
		// Use individual crypto growth calculation if crypto parameters are available
		if len(cryptoParamMap) > 0 {
			result.CryptoValue = s.calculateCryptoValueWithIndividualGrowth(
				currentValues.CryptoValue, year, cryptoParamMap, paramMap["crypto"])
		} else {
			result.CryptoValue = currentValues.CryptoValue * math.Pow(1+paramMap["crypto"].ExpectedAnnualReturn/100, float64(year))
		}
		
		result.RealEstateValue = currentValues.RealEstateValue * math.Pow(1+paramMap["real_estate"].ExpectedAnnualReturn/100, float64(year))
		result.CashValue = currentValues.CashValue * math.Pow(1+paramMap["cash"].ExpectedAnnualReturn/100, float64(year))
		result.OtherAssetsValue = currentValues.OtherAssetsValue * math.Pow(1+paramMap["other_assets"].ExpectedAnnualReturn/100, float64(year))

		result.TotalNetWorth = result.StockValue + result.CryptoValue + result.RealEstateValue + result.CashValue + result.OtherAssetsValue

		// Calculate projected Bitcoin price and net worth in BTC
		result.ProjectedBitcoinPrice = portfolio.CurrentBitcoinPrice * math.Pow(1+paramMap["crypto"].ExpectedAnnualReturn/100, float64(year))
		if result.ProjectedBitcoinPrice > 0 {
			result.NetWorthInBTC = result.TotalNetWorth / result.ProjectedBitcoinPrice
		}

		// Calculate asset allocation
		if result.TotalNetWorth > 0 {
			result.AssetAllocation = map[string]float64{
				"stocks":       (result.StockValue / result.TotalNetWorth) * 100,
				"crypto":       (result.CryptoValue / result.TotalNetWorth) * 100,
				"real_estate":  (result.RealEstateValue / result.TotalNetWorth) * 100,
				"cash":         (result.CashValue / result.TotalNetWorth) * 100,
				"other_assets": (result.OtherAssetsValue / result.TotalNetWorth) * 100,
			}
		} else {
			result.AssetAllocation = map[string]float64{
				"stocks": 0, "crypto": 0, "real_estate": 0, "cash": 0, "other_assets": 0,
			}
		}

		// Store result in database
		allocationJSON, _ := json.Marshal(result.AssetAllocation)
		err = s.db.QueryRow(insertQuery, scenarioID, year, result.TotalNetWorth, result.NetWorthInBTC,
			result.ProjectedBitcoinPrice, result.StockValue, result.CryptoValue, result.RealEstateValue,
			result.CashValue, result.OtherAssetsValue, allocationJSON).
			Scan(&result.ID, &result.CalculatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to store result: %w", err)
		}

		results = append(results, result)
	}

	return results, nil
}

// applyBitcoinAllocation adjusts the portfolio allocation by moving specified percentage to Bitcoin
func (s *ScenarioService) applyBitcoinAllocation(portfolio *CurrentPortfolio, bitcoinPercentage float64) *CurrentPortfolio {
	fmt.Printf("DEBUG: Applying Bitcoin allocation: %.2f%%\n", bitcoinPercentage)
	fmt.Printf("DEBUG: Before allocation - Stock: %.2f, Crypto: %.2f, Real Estate: %.2f, Cash: %.2f, Other: %.2f\n",
		portfolio.StockValue, portfolio.CryptoValue, portfolio.RealEstateValue, 
		portfolio.CashValue, portfolio.OtherAssetsValue)
	
	if bitcoinPercentage == 0 {
		return portfolio
	}

	// Calculate total portfolio value and target Bitcoin allocation
	totalPortfolioValue := portfolio.TotalValue
	targetBitcoinValue := totalPortfolioValue * (bitcoinPercentage / 100)
	currentCryptoValue := portfolio.CryptoValue
	
	// Amount to move to Bitcoin (if target is more than current crypto, otherwise no movement)
	amountToMove := 0.0
	if targetBitcoinValue > currentCryptoValue {
		amountToMove = targetBitcoinValue - currentCryptoValue
	}
	
	fmt.Printf("DEBUG: Total portfolio: %.2f, Target Bitcoin: %.2f, Current crypto: %.2f, Amount to move: %.2f\n", 
		totalPortfolioValue, targetBitcoinValue, currentCryptoValue, amountToMove)

	// Proportionally reduce non-crypto assets to get the amount to move
	var adjustedStock, adjustedRealEstate, adjustedCash, adjustedOther float64
	totalNonCrypto := portfolio.StockValue + portfolio.RealEstateValue + portfolio.CashValue + portfolio.OtherAssetsValue
	
	if amountToMove > 0 && totalNonCrypto > 0 {
		// Reduce each asset proportionally based on amount to move
		reductionRatio := amountToMove / totalNonCrypto
		adjustedStock = portfolio.StockValue * (1 - reductionRatio)
		adjustedRealEstate = portfolio.RealEstateValue * (1 - reductionRatio)
		adjustedCash = portfolio.CashValue * (1 - reductionRatio)
		adjustedOther = portfolio.OtherAssetsValue * (1 - reductionRatio)
	} else {
		// No movement needed or no non-crypto assets to move
		adjustedStock = portfolio.StockValue
		adjustedRealEstate = portfolio.RealEstateValue
		adjustedCash = portfolio.CashValue
		adjustedOther = portfolio.OtherAssetsValue
	}
	
	adjusted := &CurrentPortfolio{
		StockValue:       adjustedStock,
		CryptoValue:      portfolio.CryptoValue + amountToMove, // Add moved amount to existing crypto
		RealEstateValue:  adjustedRealEstate,
		CashValue:        adjustedCash,
		OtherAssetsValue: adjustedOther,
		TotalValue:       portfolio.TotalValue, // Total remains the same
		CurrentBitcoinPrice: portfolio.CurrentBitcoinPrice,
	}

	fmt.Printf("DEBUG: After allocation - Stock: %.2f, Crypto: %.2f, Real Estate: %.2f, Cash: %.2f, Other: %.2f\n",
		adjusted.StockValue, adjusted.CryptoValue, adjusted.RealEstateValue, 
		adjusted.CashValue, adjusted.OtherAssetsValue)

	return adjusted
}

// calculateCryptoValueWithIndividualGrowth calculates crypto portfolio value with individual crypto growth rates
func (s *ScenarioService) calculateCryptoValueWithIndividualGrowth(
	currentCryptoValue float64, 
	year int, 
	cryptoParamMap map[string]CryptoScenarioParameter, 
	defaultCryptoParam ScenarioParameter) float64 {
	
	// If no crypto holdings, return 0
	if currentCryptoValue == 0 {
		return 0
	}

	// Get individual crypto holdings and their current values
	cryptoHoldingsQuery := `
		SELECT crypto_symbol, balance_tokens 
		FROM crypto_holdings
	`
	cryptoRows, err := s.db.Query(cryptoHoldingsQuery)
	if err != nil {
		fmt.Printf("DEBUG: Failed to get crypto holdings for individual growth calculation: %v\n", err)
		// Fallback to default crypto growth rate
		return currentCryptoValue * math.Pow(1+defaultCryptoParam.ExpectedAnnualReturn/100, float64(year))
	}
	defer cryptoRows.Close()

	totalProjectedValue := 0.0
	
	for cryptoRows.Next() {
		var symbol string
		var balance float64
		if err := cryptoRows.Scan(&symbol, &balance); err != nil {
			continue
		}
		
		// Get current price using crypto service
		var currentPrice float64
		if cryptoPrice, err := s.cryptoService.GetPrice(symbol); err == nil && cryptoPrice != nil {
			currentPrice = cryptoPrice.PriceUSD
		} else {
			// Fallback to database price
			priceQuery := `SELECT COALESCE(price_usd, 0) FROM crypto_prices WHERE symbol = $1 ORDER BY last_updated DESC LIMIT 1`
			s.db.QueryRow(priceQuery, symbol).Scan(&currentPrice)
		}
		
		currentValue := balance * currentPrice
		
		// Use individual crypto parameter if available, otherwise use default crypto rate
		var growthRate float64
		if cryptoParam, exists := cryptoParamMap[strings.ToUpper(symbol)]; exists {
			growthRate = cryptoParam.ExpectedAnnualReturn
			fmt.Printf("DEBUG: Using individual growth rate for %s: %.2f%%\n", symbol, growthRate)
		} else {
			growthRate = defaultCryptoParam.ExpectedAnnualReturn
			fmt.Printf("DEBUG: Using default crypto growth rate for %s: %.2f%%\n", symbol, growthRate)
		}
		
		// Calculate projected value for this crypto
		projectedValue := currentValue * math.Pow(1+growthRate/100, float64(year))
		totalProjectedValue += projectedValue
		
		fmt.Printf("DEBUG: %s: %.8f tokens × $%.2f = $%.2f → $%.2f (%.2f%% growth)\n", 
			symbol, balance, currentPrice, currentValue, projectedValue, growthRate)
	}
	
	fmt.Printf("DEBUG: Total projected crypto value for year %d: $%.2f\n", year, totalProjectedValue)
	return totalProjectedValue
}

// GetAvailableCryptoSymbols returns all unique crypto symbols from holdings
func (s *ScenarioService) GetAvailableCryptoSymbols() ([]string, error) {
	query := `SELECT DISTINCT crypto_symbol FROM crypto_holdings ORDER BY crypto_symbol`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get crypto symbols: %w", err)
	}
	defer rows.Close()

	var symbols []string
	for rows.Next() {
		var symbol string
		if err := rows.Scan(&symbol); err != nil {
			continue
		}
		symbols = append(symbols, symbol)
	}

	return symbols, nil
}

// GetScenarioResults retrieves stored results for a scenario
func (s *ScenarioService) GetScenarioResults(scenarioID int) ([]ScenarioResult, error) {
	query := `
		SELECT id, projection_year, total_net_worth, net_worth_in_btc, projected_bitcoin_price,
			   stock_value, crypto_value, real_estate_value, cash_value, other_assets_value,
			   asset_allocation, calculated_at
		FROM scenario_results
		WHERE scenario_id = $1
		ORDER BY projection_year
	`
	rows, err := s.db.Query(query, scenarioID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch scenario results: %w", err)
	}
	defer rows.Close()

	var results []ScenarioResult
	for rows.Next() {
		var result ScenarioResult
		var allocationJSON []byte
		err := rows.Scan(&result.ID, &result.ProjectionYear, &result.TotalNetWorth, 
			&result.NetWorthInBTC, &result.ProjectedBitcoinPrice, &result.StockValue, 
			&result.CryptoValue, &result.RealEstateValue, &result.CashValue, 
			&result.OtherAssetsValue, &allocationJSON, &result.CalculatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan scenario result: %w", err)
		}

		if len(allocationJSON) > 0 {
			json.Unmarshal(allocationJSON, &result.AssetAllocation)
		}

		result.ScenarioID = scenarioID
		results = append(results, result)
	}

	return results, nil
}

// DeleteScenario removes a scenario and all its data
func (s *ScenarioService) DeleteScenario(id int) error {
	query := `DELETE FROM scenarios WHERE id = $1`
	result, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete scenario: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("scenario not found")
	}

	return nil
}

// UpdateScenario updates an existing scenario
func (s *ScenarioService) UpdateScenario(scenario *Scenario) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Update scenario
	query := `
		UPDATE scenarios 
		SET name = $1, description = $2, time_horizon_years = $3, 
			rebalancing_frequency = $4, bitcoin_allocation_percentage = $5, updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
		RETURNING updated_at
	`
	err = tx.QueryRow(query, scenario.Name, scenario.Description, scenario.TimeHorizonYears, 
		scenario.RebalancingFrequency, scenario.BitcoinAllocationPercentage, scenario.ID).
		Scan(&scenario.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to update scenario: %w", err)
	}

	// Delete existing parameters
	_, err = tx.Exec("DELETE FROM scenario_parameters WHERE scenario_id = $1", scenario.ID)
	if err != nil {
		return fmt.Errorf("failed to delete existing parameters: %w", err)
	}

	// Delete existing crypto parameters
	_, err = tx.Exec("DELETE FROM crypto_scenario_parameters WHERE scenario_id = $1", scenario.ID)
	if err != nil {
		return fmt.Errorf("failed to delete existing crypto parameters: %w", err)
	}

	// Insert new parameters
	for _, param := range scenario.Parameters {
		customParamsJSON, _ := json.Marshal(param.CustomParameters)
		paramQuery := `
			INSERT INTO scenario_parameters (scenario_id, asset_class, expected_annual_return, annual_volatility, custom_parameters)
			VALUES ($1, $2, $3, $4, $5)
		`
		_, err = tx.Exec(paramQuery, scenario.ID, param.AssetClass, param.ExpectedAnnualReturn, 
			param.AnnualVolatility, customParamsJSON)
		if err != nil {
			return fmt.Errorf("failed to create scenario parameter: %w", err)
		}
	}

	// Insert new crypto parameters
	for _, param := range scenario.CryptoParameters {
		customParamsJSON, _ := json.Marshal(param.CustomParameters)
		cryptoParamQuery := `
			INSERT INTO crypto_scenario_parameters (scenario_id, crypto_symbol, expected_annual_return, annual_volatility, custom_parameters)
			VALUES ($1, $2, $3, $4, $5)
		`
		_, err = tx.Exec(cryptoParamQuery, scenario.ID, param.CryptoSymbol, param.ExpectedAnnualReturn, 
			param.AnnualVolatility, customParamsJSON)
		if err != nil {
			return fmt.Errorf("failed to create crypto scenario parameter: %w", err)
		}
	}

	return tx.Commit()
}