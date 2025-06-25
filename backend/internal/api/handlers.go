package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"networth-dashboard/internal/services"

	"github.com/gin-gonic/gin"
)

// Placeholder handlers - will be implemented in future phases

// Net worth handlers
func (s *Server) getNetWorth(c *gin.Context) {
	// Calculate stock holdings value
	stockValue := s.calculateStockHoldingsValue()

	// Calculate vested equity value (only vested shares count toward net worth)
	vestedEquityValue := s.calculateVestedEquityValue()

	// Calculate unvested equity value (future value, shown separately)
	unvestedEquityValue := s.calculateUnvestedEquityValue()

	// Calculate real estate equity
	realEstateEquity := s.calculateRealEstateEquity()

	// Calculate cash holdings value
	cashHoldingsValue := s.calculateCashHoldingsValue()

	// Calculate liabilities
	totalLiabilities := s.calculateTotalLiabilities()

	// Net worth = only vested/liquid assets - liabilities
	totalAssets := stockValue + vestedEquityValue + realEstateEquity + cashHoldingsValue
	netWorth := totalAssets - totalLiabilities

	// Get price status information
	priceStatus := s.getPriceStatus()

	data := gin.H{
		"net_worth":             netWorth,
		"total_assets":          totalAssets,
		"total_liabilities":     totalLiabilities,
		"vested_equity_value":   vestedEquityValue,
		"unvested_equity_value": unvestedEquityValue, // Shown separately as future value
		"stock_holdings_value":  stockValue,
		"real_estate_equity":    realEstateEquity,
		"cash_holdings_value":   cashHoldingsValue,
		"price_last_updated":    priceStatus.LastUpdated,
		"stale_price_count":     priceStatus.StaleCount,
		"provider_name":         priceStatus.ProviderName,
		"last_updated":          time.Now().Format(time.RFC3339),
	}
	c.JSON(http.StatusOK, data)
}

// Helper functions for net worth calculation
func (s *Server) calculateStockHoldingsValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(shares_owned * COALESCE(current_price, 0)), 0) 
		FROM stock_holdings
		WHERE current_price > 0
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateVestedEquityValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(vested_shares * COALESCE(current_price, 0)), 0) 
		FROM equity_grants 
		WHERE current_price > 0 AND vested_shares > 0
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateUnvestedEquityValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(unvested_shares * COALESCE(current_price, 0)), 0) 
		FROM equity_grants 
		WHERE current_price > 0 AND unvested_shares > 0
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateRealEstateEquity() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(equity), 0) 
		FROM real_estate_properties
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateCashHoldingsValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(current_balance), 0) 
		FROM cash_holdings
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateTotalLiabilities() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(outstanding_mortgage), 0) 
		FROM real_estate_properties
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

// PriceStatus represents the current status of price data
type PriceStatus struct {
	LastUpdated  string `json:"last_updated"`
	StaleCount   int    `json:"stale_count"`
	TotalCount   int    `json:"total_count"`
	ProviderName string `json:"provider_name"`
}

func (s *Server) getPriceStatus() PriceStatus {
	priceService := services.NewPriceService()

	// Count total symbols and stale prices
	var totalCount, staleCount int

	// Count symbols with stale or missing prices (older than 1 hour or null)
	staleQuery := `
		SELECT COUNT(DISTINCT symbol) as stale_count,
		       (SELECT COUNT(DISTINCT symbol) FROM (
		           SELECT symbol FROM stock_holdings 
		           UNION 
		           SELECT company_symbol as symbol FROM equity_grants
		       ) as all_symbols) as total_count
		FROM (
		    SELECT symbol FROM stock_holdings 
		    WHERE current_price = 0 OR current_price IS NULL
		    UNION
		    SELECT company_symbol as symbol FROM equity_grants 
		    WHERE current_price = 0 OR current_price IS NULL
		) as stale_symbols
	`

	err := s.db.QueryRow(staleQuery).Scan(&staleCount, &totalCount)
	if err != nil {
		staleCount = 0
		totalCount = 0
	}

	return PriceStatus{
		LastUpdated:  time.Now().Format(time.RFC3339),
		StaleCount:   staleCount,
		TotalCount:   totalCount,
		ProviderName: priceService.GetProviderName(),
	}
}

func (s *Server) getNetWorthHistory(c *gin.Context) {
	// TODO: Implement net worth history
	c.JSON(http.StatusOK, gin.H{
		"message": "Net worth history endpoint - to be implemented",
	})
}

// Account handlers
func (s *Server) getAccounts(c *gin.Context) {
	// TODO: Implement account retrieval
	c.JSON(http.StatusOK, gin.H{
		"accounts": []gin.H{},
		"message":  "Accounts endpoint - to be implemented",
	})
}

func (s *Server) getAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement single account retrieval
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Single account endpoint - to be implemented",
	})
}

func (s *Server) createAccount(c *gin.Context) {
	// TODO: Implement account creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create account endpoint - to be implemented",
	})
}

func (s *Server) updateAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement account update
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Update account endpoint - to be implemented",
	})
}

func (s *Server) deleteAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement account deletion
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Delete account endpoint - to be implemented",
	})
}

// Balance handlers
func (s *Server) getBalances(c *gin.Context) {
	// TODO: Implement balance retrieval
	c.JSON(http.StatusOK, gin.H{
		"balances": []gin.H{},
		"message":  "Balances endpoint - to be implemented",
	})
}

func (s *Server) getAccountBalances(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement account-specific balance retrieval
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"balances":   []gin.H{},
		"message":    "Account balances endpoint - to be implemented",
	})
}

// Stock holdings handlers
func (s *Server) getStockHoldings(c *gin.Context) {
	query := `
		SELECT h.id, h.account_id, h.symbol, h.company_name, h.shares_owned, 
		       h.cost_basis, h.current_price, h.data_source, h.created_at,
		       COALESCE(h.shares_owned * h.current_price, 0) as market_value
		FROM stock_holdings h
		ORDER BY h.symbol
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch stock holdings",
		})
		return
	}
	defer rows.Close()

	holdings := make([]map[string]interface{}, 0)
	for rows.Next() {
		var holding struct {
			ID           int      `json:"id"`
			AccountID    int      `json:"account_id"`
			Symbol       string   `json:"symbol"`
			CompanyName  *string  `json:"company_name"`
			SharesOwned  float64  `json:"shares_owned"`
			CostBasis    *float64 `json:"cost_basis"`
			CurrentPrice *float64 `json:"current_price"`
			MarketValue  float64  `json:"market_value"`
			DataSource   string   `json:"data_source"`
			CreatedAt    string   `json:"created_at"`
		}

		err := rows.Scan(
			&holding.ID, &holding.AccountID, &holding.Symbol, &holding.CompanyName,
			&holding.SharesOwned, &holding.CostBasis, &holding.CurrentPrice,
			&holding.DataSource, &holding.CreatedAt, &holding.MarketValue,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan stock holding",
			})
			return
		}

		holdingMap := map[string]interface{}{
			"id":            holding.ID,
			"account_id":    holding.AccountID,
			"symbol":        holding.Symbol,
			"company_name":  holding.CompanyName,
			"shares_owned":  holding.SharesOwned,
			"cost_basis":    holding.CostBasis,
			"current_price": holding.CurrentPrice,
			"market_value":  holding.MarketValue,
			"data_source":   holding.DataSource,
			"created_at":    holding.CreatedAt,
		}
		holdings = append(holdings, holdingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"stocks": holdings,
	})
}

func (s *Server) getConsolidatedStocks(c *gin.Context) {
	query := `
		SELECT symbol, 
		       COALESCE(MAX(company_name), symbol) as company_name,
		       SUM(shares_owned) as total_shares,
		       COALESCE(AVG(NULLIF(current_price, 0)), 0) as current_price,
		       SUM(shares_owned * COALESCE(current_price, 0)) as total_value,
		       COALESCE(
		           SUM(shares_owned * COALESCE(current_price, 0)) - 
		           SUM(shares_owned * COALESCE(cost_basis, 0)), 
		           0
		       ) as unrealized_gains
		FROM stock_holdings 
		WHERE shares_owned > 0
		GROUP BY symbol
		ORDER BY total_value DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch consolidated stocks",
		})
		return
	}
	defer rows.Close()

	consolidatedStocks := make([]map[string]interface{}, 0)
	for rows.Next() {
		var stock struct {
			Symbol          string  `json:"symbol"`
			CompanyName     string  `json:"company_name"`
			TotalShares     float64 `json:"total_shares"`
			CurrentPrice    float64 `json:"current_price"`
			TotalValue      float64 `json:"total_value"`
			UnrealizedGains float64 `json:"unrealized_gains"`
		}

		err := rows.Scan(
			&stock.Symbol, &stock.CompanyName, &stock.TotalShares,
			&stock.CurrentPrice, &stock.TotalValue, &stock.UnrealizedGains,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan consolidated stock",
			})
			return
		}

		// Get sources for this symbol
		sourcesQuery := `
			SELECT id, account_id, shares_owned, cost_basis, data_source, created_at
			FROM stock_holdings 
			WHERE symbol = $1 AND shares_owned > 0
			ORDER BY data_source
		`

		sourceRows, err := s.db.Query(sourcesQuery, stock.Symbol)
		if err != nil {
			continue // Skip if can't get sources, but continue with consolidated data
		}

		sources := make([]map[string]interface{}, 0)
		for sourceRows.Next() {
			var source struct {
				ID          int      `json:"id"`
				AccountID   int      `json:"account_id"`
				SharesOwned float64  `json:"shares_owned"`
				CostBasis   *float64 `json:"cost_basis"`
				DataSource  string   `json:"data_source"`
				CreatedAt   string   `json:"created_at"`
			}

			err := sourceRows.Scan(
				&source.ID, &source.AccountID, &source.SharesOwned,
				&source.CostBasis, &source.DataSource, &source.CreatedAt,
			)
			if err != nil {
				continue
			}

			sourceMap := map[string]interface{}{
				"id":            source.ID,
				"account_id":    source.AccountID,
				"symbol":        stock.Symbol,
				"company_name":  stock.CompanyName,
				"shares_owned":  source.SharesOwned,
				"cost_basis":    source.CostBasis,
				"current_price": stock.CurrentPrice,
				"market_value":  source.SharesOwned * stock.CurrentPrice,
				"data_source":   source.DataSource,
				"created_at":    source.CreatedAt,
			}
			sources = append(sources, sourceMap)
		}
		sourceRows.Close()

		stockMap := map[string]interface{}{
			"symbol":           stock.Symbol,
			"company_name":     stock.CompanyName,
			"total_shares":     stock.TotalShares,
			"total_value":      stock.TotalValue,
			"current_price":    stock.CurrentPrice,
			"unrealized_gains": stock.UnrealizedGains,
			"sources":          sources,
		}
		consolidatedStocks = append(consolidatedStocks, stockMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"consolidated_stocks": consolidatedStocks,
	})
}

func (s *Server) createStockHolding(c *gin.Context) {
	// TODO: Implement stock holding creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create stock holding endpoint - to be implemented",
	})
}

func (s *Server) updateStockHolding(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement stock holding update
	c.JSON(http.StatusOK, gin.H{
		"stock_id": id,
		"message":  "Update stock holding endpoint - to be implemented",
	})
}

func (s *Server) deleteStockHolding(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement stock holding deletion
	c.JSON(http.StatusOK, gin.H{
		"stock_id": id,
		"message":  "Delete stock holding endpoint - to be implemented",
	})
}

// Equity compensation handlers
func (s *Server) getEquityGrants(c *gin.Context) {
	query := `
		SELECT id, account_id, grant_type, company_symbol, total_shares, 
		       vested_shares, unvested_shares, strike_price, grant_date, 
		       vest_start_date, current_price, data_source, created_at
		FROM equity_grants
		ORDER BY grant_date DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch equity grants",
		})
		return
	}
	defer rows.Close()

	grants := make([]map[string]interface{}, 0)
	for rows.Next() {
		var grant struct {
			ID             int      `json:"id"`
			AccountID      int      `json:"account_id"`
			GrantType      string   `json:"grant_type"`
			CompanySymbol  string   `json:"company_symbol"`
			TotalShares    float64  `json:"total_shares"`
			VestedShares   float64  `json:"vested_shares"`
			UnvestedShares float64  `json:"unvested_shares"`
			StrikePrice    *float64 `json:"strike_price"`
			GrantDate      string   `json:"grant_date"`
			VestStartDate  string   `json:"vest_start_date"`
			CurrentPrice   *float64 `json:"current_price"`
			DataSource     string   `json:"data_source"`
			CreatedAt      string   `json:"created_at"`
		}

		err := rows.Scan(
			&grant.ID, &grant.AccountID, &grant.GrantType, &grant.CompanySymbol,
			&grant.TotalShares, &grant.VestedShares, &grant.UnvestedShares,
			&grant.StrikePrice, &grant.GrantDate, &grant.VestStartDate, &grant.CurrentPrice, &grant.DataSource, &grant.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan equity grant",
			})
			return
		}

		grantMap := map[string]interface{}{
			"id":              grant.ID,
			"account_id":      grant.AccountID,
			"grant_type":      grant.GrantType,
			"company_symbol":  grant.CompanySymbol,
			"total_shares":    grant.TotalShares,
			"vested_shares":   grant.VestedShares,
			"unvested_shares": grant.UnvestedShares,
			"strike_price":    grant.StrikePrice,
			"grant_date":      grant.GrantDate,
			"vest_start_date": grant.VestStartDate,
			"current_price":   grant.CurrentPrice,
			"data_source":     grant.DataSource,
			"created_at":      grant.CreatedAt,
		}
		grants = append(grants, grantMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"equity_grants": grants,
	})
}

func (s *Server) getVestingSchedule(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement vesting schedule retrieval
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"vesting":  []gin.H{},
		"message":  "Vesting schedule endpoint - to be implemented",
	})
}

func (s *Server) createEquityGrant(c *gin.Context) {
	// TODO: Implement equity grant creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create equity grant endpoint - to be implemented",
	})
}

func (s *Server) updateEquityGrant(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement equity grant update
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Update equity grant endpoint - to be implemented",
	})
}

func (s *Server) deleteEquityGrant(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement equity grant deletion
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Delete equity grant endpoint - to be implemented",
	})
}

// Real estate handlers
func (s *Server) getRealEstate(c *gin.Context) {
	query := `
		SELECT id, account_id, property_type, property_name, purchase_price, 
		       current_value, outstanding_mortgage, equity, purchase_date, 
		       property_size_sqft, lot_size_acres, rental_income_monthly, 
		       property_tax_annual, notes, created_at
		FROM real_estate_properties
		ORDER BY property_name
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch real estate properties",
		})
		return
	}
	defer rows.Close()

	properties := make([]map[string]interface{}, 0)
	for rows.Next() {
		var property struct {
			ID                  int      `json:"id"`
			AccountID           int      `json:"account_id"`
			PropertyType        string   `json:"property_type"`
			PropertyName        string   `json:"property_name"`
			PurchasePrice       float64  `json:"purchase_price"`
			CurrentValue        float64  `json:"current_value"`
			OutstandingMortgage float64  `json:"outstanding_mortgage"`
			Equity              float64  `json:"equity"`
			PurchaseDate        string   `json:"purchase_date"`
			PropertySizeSqft    *float64 `json:"property_size_sqft"`
			LotSizeAcres        *float64 `json:"lot_size_acres"`
			RentalIncomeMonthly *float64 `json:"rental_income_monthly"`
			PropertyTaxAnnual   *float64 `json:"property_tax_annual"`
			Notes               *string  `json:"notes"`
			CreatedAt           string   `json:"created_at"`
		}

		err := rows.Scan(
			&property.ID, &property.AccountID, &property.PropertyType, &property.PropertyName,
			&property.PurchasePrice, &property.CurrentValue, &property.OutstandingMortgage,
			&property.Equity, &property.PurchaseDate, &property.PropertySizeSqft,
			&property.LotSizeAcres, &property.RentalIncomeMonthly, &property.PropertyTaxAnnual,
			&property.Notes, &property.CreatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan real estate property",
			})
			return
		}

		propertyMap := map[string]interface{}{
			"id":                    property.ID,
			"account_id":            property.AccountID,
			"property_type":         property.PropertyType,
			"property_name":         property.PropertyName,
			"purchase_price":        property.PurchasePrice,
			"current_value":         property.CurrentValue,
			"outstanding_mortgage":  property.OutstandingMortgage,
			"equity":                property.Equity,
			"purchase_date":         property.PurchaseDate,
			"property_size_sqft":    property.PropertySizeSqft,
			"lot_size_acres":        property.LotSizeAcres,
			"rental_income_monthly": property.RentalIncomeMonthly,
			"property_tax_annual":   property.PropertyTaxAnnual,
			"notes":                 property.Notes,
			"created_at":            property.CreatedAt,
		}
		properties = append(properties, propertyMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"real_estate": properties,
	})
}

func (s *Server) getCashHoldings(c *gin.Context) {
	query := `
		SELECT id, account_id, institution_name, account_name, account_type, 
		       current_balance, interest_rate, monthly_contribution, 
		       account_number_last4, currency, notes, created_at, updated_at
		FROM cash_holdings
		ORDER BY institution_name, account_name
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch cash holdings",
		})
		return
	}
	defer rows.Close()

	holdings := make([]map[string]interface{}, 0)
	for rows.Next() {
		var holding struct {
			ID                  int      `json:"id"`
			AccountID           int      `json:"account_id"`
			InstitutionName     string   `json:"institution_name"`
			AccountName         string   `json:"account_name"`
			AccountType         string   `json:"account_type"`
			CurrentBalance      float64  `json:"current_balance"`
			InterestRate        *float64 `json:"interest_rate"`
			MonthlyContribution *float64 `json:"monthly_contribution"`
			AccountNumberLast4  *string  `json:"account_number_last4"`
			Currency            string   `json:"currency"`
			Notes               *string  `json:"notes"`
			CreatedAt           string   `json:"created_at"`
			UpdatedAt           string   `json:"updated_at"`
		}

		err := rows.Scan(
			&holding.ID, &holding.AccountID, &holding.InstitutionName, &holding.AccountName,
			&holding.AccountType, &holding.CurrentBalance, &holding.InterestRate,
			&holding.MonthlyContribution, &holding.AccountNumberLast4, &holding.Currency,
			&holding.Notes, &holding.CreatedAt, &holding.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan cash holding",
			})
			return
		}

		holdingMap := map[string]interface{}{
			"id":                    holding.ID,
			"account_id":            holding.AccountID,
			"institution_name":      holding.InstitutionName,
			"account_name":          holding.AccountName,
			"account_type":          holding.AccountType,
			"current_balance":       holding.CurrentBalance,
			"interest_rate":         holding.InterestRate,
			"monthly_contribution":  holding.MonthlyContribution,
			"account_number_last4":  holding.AccountNumberLast4,
			"currency":              holding.Currency,
			"notes":                 holding.Notes,
			"created_at":            holding.CreatedAt,
			"updated_at":            holding.UpdatedAt,
		}
		holdings = append(holdings, holdingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"cash_holdings": holdings,
	})
}

func (s *Server) createRealEstate(c *gin.Context) {
	// TODO: Implement real estate creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create real estate endpoint - to be implemented",
	})
}

func (s *Server) updateRealEstate(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid property ID",
		})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Use real estate plugin to update the property
	plugin, err := s.pluginManager.GetPlugin("real_estate")
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Real estate plugin not found",
		})
		return
	}

	if !plugin.SupportsManualEntry() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Real estate plugin does not support manual entry",
		})
		return
	}

	// Update the property using the plugin
	if err := plugin.UpdateManualEntry(id, data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Property updated successfully",
	})
}

func (s *Server) deleteRealEstate(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement real estate deletion
	c.JSON(http.StatusOK, gin.H{
		"property_id": id,
		"message":     "Delete real estate endpoint - to be implemented",
	})
}

// Plugin handlers
func (s *Server) getPlugins(c *gin.Context) {
	plugins := s.pluginManager.ListPlugins()
	c.JSON(http.StatusOK, gin.H{
		"plugins": plugins,
		"count":   len(plugins),
	})
}

func (s *Server) getPluginSchema(c *gin.Context) {
	pluginName := c.Param("name")

	plugin, err := s.pluginManager.GetPlugin(pluginName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Plugin not found",
		})
		return
	}

	if !plugin.SupportsManualEntry() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	schema := plugin.GetManualEntrySchema()
	c.JSON(http.StatusOK, schema)
}

func (s *Server) processManualEntry(c *gin.Context) {
	pluginName := c.Param("name")

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	if err := s.pluginManager.ProcessManualEntry(pluginName, data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Manual entry processed successfully",
	})
}

func (s *Server) refreshPluginData(c *gin.Context) {
	errors := s.pluginManager.RefreshAllData()

	if len(errors) > 0 {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Some plugins failed to refresh",
			"details": errors,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Plugin data refreshed successfully",
	})
}

func (s *Server) getPluginHealth(c *gin.Context) {
	health := s.pluginManager.GetPluginHealth()

	allHealthy := true
	for _, pluginHealth := range health {
		if pluginHealth.Status != "active" {
			allHealthy = false
			break
		}
	}

	status := http.StatusOK
	if !allHealthy {
		status = http.StatusServiceUnavailable
	}

	c.JSON(status, gin.H{
		"healthy": allHealthy,
		"plugins": health,
	})
}

// Manual entry handlers
func (s *Server) getManualEntries(c *gin.Context) {
	entryType := c.Query("type") // Optional filter by entry type

	// Build unified query to get manual entries from all relevant tables
	query := `
		SELECT 'computershare' as entry_type, 
		       sh.id, sh.account_id, sh.created_at, sh.created_at as updated_at,
		       json_build_object(
		           'symbol', sh.symbol,
		           'company_name', sh.company_name,
		           'shares_owned', sh.shares_owned,
		           'cost_basis', sh.cost_basis,
		           'current_price', sh.current_price
		       ) as data_json,
		       a.account_name, a.institution
		FROM stock_holdings sh
		LEFT JOIN accounts a ON sh.account_id = a.id
		WHERE sh.data_source = 'computershare'
		
		UNION ALL
		
		SELECT 'morgan_stanley' as entry_type,
		       eg.id, eg.account_id, eg.created_at, eg.created_at as updated_at,
		       json_build_object(
		           'grant_type', eg.grant_type,
		           'company_symbol', eg.company_symbol,
		           'total_shares', eg.total_shares,
		           'vested_shares', eg.vested_shares,
		           'unvested_shares', eg.unvested_shares,
		           'strike_price', eg.strike_price,
		           'grant_date', eg.grant_date,
		           'vest_start_date', eg.vest_start_date,
		           'current_price', eg.current_price
		       ) as data_json,
		       a.account_name, a.institution
		FROM equity_grants eg
		LEFT JOIN accounts a ON eg.account_id = a.id
		WHERE eg.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'real_estate' as entry_type,
		       re.id, re.account_id, re.created_at, re.created_at as updated_at,
		       json_build_object(
		           'property_type', re.property_type,
		           'property_name', re.property_name,
		           'purchase_price', re.purchase_price,
		           'current_value', re.current_value,
		           'outstanding_mortgage', re.outstanding_mortgage,
		           'equity', re.equity,
		           'purchase_date', re.purchase_date,
		           'property_size_sqft', re.property_size_sqft,
		           'lot_size_acres', re.lot_size_acres,
		           'rental_income_monthly', re.rental_income_monthly,
		           'property_tax_annual', re.property_tax_annual,
		           'notes', re.notes
		       ) as data_json,
		       a.account_name, a.institution
		FROM real_estate_properties re
		LEFT JOIN accounts a ON re.account_id = a.id
		WHERE re.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'cash_holdings' as entry_type,
		       ch.id, ch.account_id, ch.created_at, ch.updated_at,
		       json_build_object(
		           'institution_name', ch.institution_name,
		           'account_name', ch.account_name,
		           'account_type', ch.account_type,
		           'current_balance', ch.current_balance,
		           'interest_rate', ch.interest_rate,
		           'monthly_contribution', ch.monthly_contribution,
		           'account_number_last4', ch.account_number_last4,
		           'currency', ch.currency,
		           'notes', ch.notes
		       ) as data_json,
		       a.account_name, a.institution
		FROM cash_holdings ch
		LEFT JOIN accounts a ON ch.account_id = a.id
		WHERE ch.created_at IS NOT NULL
	`

	args := []interface{}{}

	// Add filter if entry type is specified
	if entryType != "" {
		query = `
			SELECT * FROM (` + query + `) as all_entries 
			WHERE entry_type = $1
			ORDER BY created_at DESC
		`
		args = append(args, entryType)
	} else {
		query += " ORDER BY created_at DESC"
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch manual entries",
		})
		return
	}
	defer rows.Close()

	entries := make([]map[string]interface{}, 0)
	for rows.Next() {
		var entry struct {
			EntryType   string  `json:"entry_type"`
			ID          int     `json:"id"`
			AccountID   int     `json:"account_id"`
			CreatedAt   string  `json:"created_at"`
			UpdatedAt   string  `json:"updated_at"`
			DataJSON    string  `json:"data_json"`
			AccountName *string `json:"account_name"`
			Institution *string `json:"institution"`
		}

		err := rows.Scan(
			&entry.EntryType, &entry.ID, &entry.AccountID, &entry.CreatedAt, &entry.UpdatedAt,
			&entry.DataJSON, &entry.AccountName, &entry.Institution,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan manual entry",
			})
			return
		}

		entryMap := map[string]interface{}{
			"id":           entry.ID,
			"account_id":   entry.AccountID,
			"entry_type":   entry.EntryType,
			"data_json":    entry.DataJSON,
			"created_at":   entry.CreatedAt,
			"updated_at":   entry.UpdatedAt,
			"account_name": entry.AccountName,
			"institution":  entry.Institution,
		}
		entries = append(entries, entryMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"manual_entries": entries,
	})
}

func (s *Server) createManualEntry(c *gin.Context) {
	// TODO: Implement manual entry creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create manual entry endpoint - to be implemented",
	})
}

func (s *Server) updateManualEntry(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid entry ID",
		})
		return
	}

	entryType := c.Query("type")
	if entryType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Entry type is required",
		})
		return
	}

	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Use plugin manager to update the entry
	plugin, err := s.pluginManager.GetPlugin(entryType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Plugin not found",
		})
		return
	}

	if !plugin.SupportsManualEntry() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Update the entry using the plugin
	if err := plugin.UpdateManualEntry(id, data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Manual entry updated successfully",
	})
}

func (s *Server) deleteManualEntry(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid entry ID",
		})
		return
	}

	entryType := c.Query("type")
	if entryType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Entry type is required",
		})
		return
	}

	var query string
	switch entryType {
	case "computershare":
		query = "DELETE FROM stock_holdings WHERE id = $1 AND data_source = 'computershare'"
	case "morgan_stanley":
		query = "DELETE FROM equity_grants WHERE id = $1"
	case "real_estate":
		query = "DELETE FROM real_estate_properties WHERE id = $1"
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid entry type",
		})
		return
	}

	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete entry",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check deletion result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Entry not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Entry deleted successfully",
	})
}

func (s *Server) getManualEntrySchemas(c *gin.Context) {
	schemas := s.pluginManager.GetManualEntrySchemas()
	c.JSON(http.StatusOK, gin.H{
		"schemas": schemas,
	})
}

// Price refresh handlers
func (s *Server) refreshPrices(c *gin.Context) {
	startTime := time.Now()

	// Get all unique symbols that need price updates
	symbols := s.getAllActiveSymbols()
	if len(symbols) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No symbols found to update",
			"summary": services.PriceRefreshSummary{
				TotalSymbols:   0,
				UpdatedSymbols: 0,
				FailedSymbols:  0,
				Timestamp:      time.Now(),
				DurationMs:     time.Since(startTime).Milliseconds(),
			},
		})
		return
	}

	// Initialize price service
	priceService := services.NewPriceService()

	// Track results
	var results []services.PriceUpdateResult
	updatedCount := 0
	failedCount := 0

	for _, symbol := range symbols {
		result := s.updateSymbolPrice(symbol, priceService)
		results = append(results, result)

		if result.Updated {
			updatedCount++
		} else {
			failedCount++
		}
	}

	summary := services.PriceRefreshSummary{
		TotalSymbols:   len(symbols),
		UpdatedSymbols: updatedCount,
		FailedSymbols:  failedCount,
		Results:        results,
		ProviderName:   priceService.GetProviderName(),
		Timestamp:      time.Now(),
		DurationMs:     time.Since(startTime).Milliseconds(),
	}

	status := http.StatusOK
	if failedCount == len(symbols) {
		status = http.StatusInternalServerError
	} else if failedCount > 0 {
		status = http.StatusPartialContent
	}

	c.JSON(status, gin.H{
		"message": fmt.Sprintf("Price refresh completed: %d/%d symbols updated", updatedCount, len(symbols)),
		"summary": summary,
	})
}

func (s *Server) refreshSymbolPrice(c *gin.Context) {
	symbol := strings.ToUpper(strings.TrimSpace(c.Param("symbol")))
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Symbol is required",
		})
		return
	}

	priceService := services.NewPriceService()
	result := s.updateSymbolPrice(symbol, priceService)

	status := http.StatusOK
	if !result.Updated {
		status = http.StatusInternalServerError
	}

	c.JSON(status, gin.H{
		"message": fmt.Sprintf("Price refresh for %s completed", symbol),
		"result":  result,
	})
}

func (s *Server) getPricesStatus(c *gin.Context) {
	status := s.getPriceStatus()
	c.JSON(http.StatusOK, status)
}

// Helper functions for price refresh
func (s *Server) getAllActiveSymbols() []string {
	var symbols []string

	// Get symbols from stock_holdings
	stockQuery := `SELECT DISTINCT symbol FROM stock_holdings WHERE symbol IS NOT NULL AND symbol != ''`
	rows, err := s.db.Query(stockQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var symbol string
			if rows.Scan(&symbol) == nil && symbol != "" {
				symbols = append(symbols, strings.ToUpper(strings.TrimSpace(symbol)))
			}
		}
	}

	// Get symbols from equity_grants
	equityQuery := `SELECT DISTINCT company_symbol FROM equity_grants WHERE company_symbol IS NOT NULL AND company_symbol != ''`
	rows, err = s.db.Query(equityQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var symbol string
			if rows.Scan(&symbol) == nil && symbol != "" {
				symbol = strings.ToUpper(strings.TrimSpace(symbol))
				// Avoid duplicates
				found := false
				for _, existing := range symbols {
					if existing == symbol {
						found = true
						break
					}
				}
				if !found {
					symbols = append(symbols, symbol)
				}
			}
		}
	}

	return symbols
}

func (s *Server) updateSymbolPrice(symbol string, priceService *services.PriceService) services.PriceUpdateResult {
	result := services.PriceUpdateResult{
		Symbol:    symbol,
		Updated:   false,
		Timestamp: time.Now(),
	}

	// Get current price from service
	newPrice, err := priceService.GetCurrentPrice(symbol)
	if err != nil {
		result.Error = err.Error()
		return result
	}

	// Get old price for comparison
	var oldPrice float64
	priceQuery := `
		SELECT COALESCE(current_price, 0) 
		FROM stock_holdings 
		WHERE symbol = $1 
		LIMIT 1
	`
	s.db.QueryRow(priceQuery, symbol).Scan(&oldPrice)

	result.OldPrice = oldPrice
	result.NewPrice = newPrice

	// Update stock_holdings
	stockUpdate := `
		UPDATE stock_holdings 
		SET current_price = $1, last_updated = $2 
		WHERE symbol = $3
	`
	stockResult, err := s.db.Exec(stockUpdate, newPrice, time.Now(), symbol)

	// Update equity_grants
	equityUpdate := `
		UPDATE equity_grants 
		SET current_price = $1, last_updated = $2 
		WHERE company_symbol = $3
	`
	equityResult, err2 := s.db.Exec(equityUpdate, newPrice, time.Now(), symbol)

	// Check if any rows were updated
	stockRows, _ := stockResult.RowsAffected()
	equityRows, _ := equityResult.RowsAffected()

	if err != nil && err2 != nil {
		result.Error = fmt.Sprintf("Update failed: %v, %v", err, err2)
	} else if stockRows > 0 || equityRows > 0 {
		result.Updated = true
	} else {
		result.Error = "No records found to update"
	}

	return result
}
