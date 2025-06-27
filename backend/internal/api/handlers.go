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

// @Summary Get current net worth
// @Description Calculate and return current net worth including all assets (stocks, equity, real estate, cash, crypto) minus liabilities
// @Tags net-worth
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Net worth data including breakdown by asset type"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /net-worth [get]
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

	// Calculate crypto holdings value
	cryptoHoldingsValue := s.calculateCryptoHoldingsValue()

	// Calculate liabilities
	totalLiabilities := s.calculateTotalLiabilities()

	// Net worth = only vested/liquid assets - liabilities
	totalAssets := stockValue + vestedEquityValue + realEstateEquity + cashHoldingsValue + cryptoHoldingsValue
	netWorth := totalAssets - totalLiabilities

	// Get price status information
	priceStatus := s.getPriceStatus()

	data := gin.H{
		"net_worth":              netWorth,
		"total_assets":           totalAssets,
		"total_liabilities":      totalLiabilities,
		"vested_equity_value":    vestedEquityValue,
		"unvested_equity_value":  unvestedEquityValue, // Shown separately as future value
		"stock_holdings_value":   stockValue,
		"real_estate_equity":     realEstateEquity,
		"cash_holdings_value":    cashHoldingsValue,
		"crypto_holdings_value":  cryptoHoldingsValue,
		"price_last_updated":     priceStatus.LastUpdated,
		"stale_price_count":      priceStatus.StaleCount,
		"provider_name":          priceStatus.ProviderName,
		"last_updated":           time.Now().Format(time.RFC3339),
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

func (s *Server) calculateCryptoHoldingsValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(ch.balance_tokens * COALESCE(cp.price_usd, 0)), 0)
		FROM crypto_holdings ch
		LEFT JOIN crypto_prices cp ON ch.crypto_symbol = cp.symbol
		AND cp.last_updated = (
			SELECT MAX(last_updated)
			FROM crypto_prices cp2
			WHERE cp2.symbol = ch.crypto_symbol
		)
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
	LastUpdated       string `json:"last_updated"`
	StaleCount        int    `json:"stale_count"`
	TotalCount        int    `json:"total_count"`
	ProviderName      string `json:"provider_name"`
	CacheStale        bool   `json:"cache_stale"`
	ForceRefreshNeeded bool   `json:"force_refresh_needed"`
	LastCacheUpdate   string `json:"last_cache_update,omitempty"`
	CacheAgeMinutes   int    `json:"cache_age_minutes"`
	MarketOpen        bool   `json:"market_open"`
}

func (s *Server) getPriceStatus() PriceStatus {
	priceService := s.priceService
	marketService := s.marketService
	now := time.Now()

	// Count total symbols and stale prices (null/zero prices)
	var totalCount, staleCount int
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

	// Get most recent cache update time across all symbols
	var lastCacheUpdate time.Time
	cacheQuery := `
		SELECT COALESCE(MAX(timestamp), '1970-01-01'::timestamp) as last_update
		FROM stock_prices 
		WHERE source = 'alphavantage'
	`
	
	err = s.db.QueryRow(cacheQuery).Scan(&lastCacheUpdate)
	if err != nil {
		lastCacheUpdate = time.Time{} // Zero time if error
	}

	// Calculate cache age
	var cacheAgeMinutes int
	var lastCacheUpdateStr string
	if !lastCacheUpdate.IsZero() {
		cacheAge := now.Sub(lastCacheUpdate)
		cacheAgeMinutes = int(cacheAge.Minutes())
		lastCacheUpdateStr = lastCacheUpdate.Format(time.RFC3339)
	}

	// Determine if cache is stale and force refresh is needed using market service logic
	isMarketOpen := marketService.IsMarketOpen()
	cacheStale := false
	forceRefreshNeeded := false
	
	if !lastCacheUpdate.IsZero() {
		// Use the same logic as the market service for consistency
		shouldRefresh := marketService.ShouldRefreshPricesWithForce(lastCacheUpdate, s.config.API.CacheRefreshInterval, false)
		cacheStale = shouldRefresh
		
		// Force refresh needed if cache is significantly stale
		if isMarketOpen && cacheAgeMinutes > 30 { // More than 30 min during market hours
			forceRefreshNeeded = true
		} else if !isMarketOpen && cacheAgeMinutes > 720 { // More than 12 hours when market closed
			forceRefreshNeeded = true
		}
	} else {
		// No cache data at all
		cacheStale = true
		forceRefreshNeeded = true
	}

	return PriceStatus{
		LastUpdated:       now.Format(time.RFC3339),
		StaleCount:        staleCount,
		TotalCount:        totalCount,
		ProviderName:      priceService.GetProviderName(),
		CacheStale:        cacheStale,
		ForceRefreshNeeded: forceRefreshNeeded,
		LastCacheUpdate:   lastCacheUpdateStr,
		CacheAgeMinutes:   cacheAgeMinutes,
		MarketOpen:        isMarketOpen,
	}
}

// @Summary Get net worth history
// @Description Get historical net worth data over time (placeholder - to be implemented)
// @Tags net-worth
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Net worth history data"
// @Router /net-worth/history [get]
func (s *Server) getNetWorthHistory(c *gin.Context) {
	// TODO: Implement net worth history
	c.JSON(http.StatusOK, gin.H{
		"message": "Net worth history endpoint - to be implemented",
	})
}

// Account handlers

// @Summary Get all accounts
// @Description Retrieve all financial accounts (placeholder - to be implemented)
// @Tags accounts
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of accounts"
// @Router /accounts [get]
func (s *Server) getAccounts(c *gin.Context) {
	// TODO: Implement account retrieval
	c.JSON(http.StatusOK, gin.H{
		"accounts": []gin.H{},
		"message":  "Accounts endpoint - to be implemented",
	})
}

// @Summary Get account by ID
// @Description Retrieve a specific financial account by ID (placeholder - to be implemented)
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 200 {object} map[string]interface{} "Account details"
// @Failure 404 {object} map[string]interface{} "Account not found"
// @Router /accounts/{id} [get]
func (s *Server) getAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement single account retrieval
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Single account endpoint - to be implemented",
	})
}

// @Summary Create new account
// @Description Create a new financial account (placeholder - to be implemented)
// @Tags accounts
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{} "Account created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Router /accounts [post]
func (s *Server) createAccount(c *gin.Context) {
	// TODO: Implement account creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create account endpoint - to be implemented",
	})
}

// @Summary Update account
// @Description Update an existing financial account (placeholder - to be implemented)
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 200 {object} map[string]interface{} "Account updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Account not found"
// @Router /accounts/{id} [put]
func (s *Server) updateAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement account update
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Update account endpoint - to be implemented",
	})
}

// @Summary Delete account
// @Description Delete a financial account (placeholder - to be implemented)
// @Tags accounts
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 200 {object} map[string]interface{} "Account deleted successfully"
// @Failure 404 {object} map[string]interface{} "Account not found"
// @Router /accounts/{id} [delete]
func (s *Server) deleteAccount(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement account deletion
	c.JSON(http.StatusOK, gin.H{
		"account_id": id,
		"message":    "Delete account endpoint - to be implemented",
	})
}

// Balance handlers

// @Summary Get all balances
// @Description Retrieve all account balances (placeholder - to be implemented)
// @Tags balances
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of balances"
// @Router /balances [get]
func (s *Server) getBalances(c *gin.Context) {
	// TODO: Implement balance retrieval
	c.JSON(http.StatusOK, gin.H{
		"balances": []gin.H{},
		"message":  "Balances endpoint - to be implemented",
	})
}

// @Summary Get account balances
// @Description Retrieve balances for a specific account (placeholder - to be implemented)
// @Tags balances
// @Accept json
// @Produce json
// @Param id path string true "Account ID"
// @Success 200 {object} map[string]interface{} "Account balances"
// @Failure 404 {object} map[string]interface{} "Account not found"
// @Router /accounts/{id}/balances [get]
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

// @Summary Get all stock holdings
// @Description Retrieve all stock holdings with current prices and market values
// @Tags stocks
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "List of stock holdings"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks [get]
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

// @Summary Get consolidated stock holdings
// @Description Retrieve consolidated stock holdings combining direct holdings and vested equity compensation
// @Tags stocks
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "Consolidated stock holdings with sources"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks/consolidated [get]
func (s *Server) getConsolidatedStocks(c *gin.Context) {
	query := `
		WITH combined_holdings AS (
			-- Direct stock holdings
			SELECT symbol, 
			       company_name,
			       shares_owned, 
			       cost_basis, 
			       current_price, 
			       'direct_stock' as source_type,
			       data_source
			FROM stock_holdings 
			WHERE shares_owned > 0
			
			UNION ALL
			
			-- Vested equity compensation
			SELECT company_symbol as symbol,
			       company_symbol as company_name,  -- Use symbol as fallback company name
			       vested_shares as shares_owned,
			       CASE 
			           WHEN grant_type = 'stock_option' THEN COALESCE(strike_price, 0)
			           ELSE COALESCE(current_price, 0) -- For RSUs/ESPP, cost basis is current price at vest
			       END as cost_basis,
			       current_price,
			       CONCAT('equity_', grant_type) as source_type,
			       data_source
			FROM equity_grants 
			WHERE vested_shares > 0
		)
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
		FROM combined_holdings
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

		// Get sources for this symbol (both stock holdings and equity grants)
		sourcesQuery := `
			SELECT id, account_id, shares_owned, cost_basis, data_source, created_at, 'direct_stock' as source_type, NULL as grant_type
			FROM stock_holdings 
			WHERE symbol = $1 AND shares_owned > 0
			
			UNION ALL
			
			SELECT id, account_id, vested_shares as shares_owned, 
			       CASE 
			           WHEN grant_type = 'stock_option' THEN COALESCE(strike_price, 0)
			           ELSE COALESCE(current_price, 0) 
			       END as cost_basis,
			       data_source, created_at, 'equity_compensation' as source_type, grant_type
			FROM equity_grants 
			WHERE company_symbol = $1 AND vested_shares > 0
			
			ORDER BY data_source, source_type
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
				SourceType  string   `json:"source_type"`
				GrantType   *string  `json:"grant_type"`
			}

			err := sourceRows.Scan(
				&source.ID, &source.AccountID, &source.SharesOwned,
				&source.CostBasis, &source.DataSource, &source.CreatedAt,
				&source.SourceType, &source.GrantType,
			)
			if err != nil {
				continue
			}

			// Build source display name
			sourceName := source.DataSource
			if source.SourceType == "equity_compensation" && source.GrantType != nil {
				sourceName = fmt.Sprintf("%s (%s)", source.DataSource, *source.GrantType)
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
				"data_source":   sourceName,
				"source_type":   source.SourceType,
				"grant_type":    source.GrantType,
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

// @Summary Create stock holding
// @Description Create a new stock holding record (placeholder - to be implemented)
// @Tags stocks
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{} "Stock holding created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks [post]
func (s *Server) createStockHolding(c *gin.Context) {
	// TODO: Implement stock holding creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create stock holding endpoint - to be implemented",
	})
}

// @Summary Update stock holding
// @Description Update an existing stock holding record (placeholder - to be implemented)
// @Tags stocks
// @Accept json
// @Produce json
// @Param id path string true "Stock Holding ID"
// @Success 200 {object} map[string]interface{} "Stock holding updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Stock holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks/{id} [put]
func (s *Server) updateStockHolding(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement stock holding update
	c.JSON(http.StatusOK, gin.H{
		"stock_id": id,
		"message":  "Update stock holding endpoint - to be implemented",
	})
}

// @Summary Delete stock holding
// @Description Delete a stock holding record (placeholder - to be implemented)
// @Tags stocks
// @Accept json
// @Produce json
// @Param id path string true "Stock Holding ID"
// @Success 200 {object} map[string]interface{} "Stock holding deleted successfully"
// @Failure 404 {object} map[string]interface{} "Stock holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks/{id} [delete]
func (s *Server) deleteStockHolding(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement stock holding deletion
	c.JSON(http.StatusOK, gin.H{
		"stock_id": id,
		"message":  "Delete stock holding endpoint - to be implemented",
	})
}

// Equity compensation handlers

// @Summary Get equity grants
// @Description Retrieve all equity compensation grants including stock options and RSUs
// @Tags equity
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "List of equity grants"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /equity [get]
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

// @Summary Get vesting schedule
// @Description Retrieve vesting schedule for a specific equity grant (placeholder - to be implemented)
// @Tags equity
// @Accept json
// @Produce json
// @Param id path string true "Equity Grant ID"
// @Success 200 {object} map[string]interface{} "Vesting schedule data"
// @Failure 404 {object} map[string]interface{} "Equity grant not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /equity/{id}/vesting [get]
func (s *Server) getVestingSchedule(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement vesting schedule retrieval
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"vesting":  []gin.H{},
		"message":  "Vesting schedule endpoint - to be implemented",
	})
}

// @Summary Create equity grant
// @Description Create a new equity compensation grant (placeholder - to be implemented)
// @Tags equity
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{} "Equity grant created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /equity [post]
func (s *Server) createEquityGrant(c *gin.Context) {
	// TODO: Implement equity grant creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create equity grant endpoint - to be implemented",
	})
}

// @Summary Update equity grant
// @Description Update an existing equity compensation grant (placeholder - to be implemented)
// @Tags equity
// @Accept json
// @Produce json
// @Param id path string true "Equity Grant ID"
// @Success 200 {object} map[string]interface{} "Equity grant updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Equity grant not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /equity/{id} [put]
func (s *Server) updateEquityGrant(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement equity grant update
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Update equity grant endpoint - to be implemented",
	})
}

// @Summary Delete equity grant
// @Description Delete an equity compensation grant (placeholder - to be implemented)
// @Tags equity
// @Accept json
// @Produce json
// @Param id path string true "Equity Grant ID"
// @Success 200 {object} map[string]interface{} "Equity grant deleted successfully"
// @Failure 404 {object} map[string]interface{} "Equity grant not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /equity/{id} [delete]
func (s *Server) deleteEquityGrant(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement equity grant deletion
	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Delete equity grant endpoint - to be implemented",
	})
}

// Real estate handlers

// @Summary Get real estate properties
// @Description Retrieve all real estate properties with current values and mortgage information
// @Tags real-estate
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "List of real estate properties"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /real-estate [get]
func (s *Server) getRealEstate(c *gin.Context) {
	query := `
		SELECT id, account_id, property_type, property_name, purchase_price, 
		       current_value, outstanding_mortgage, equity, 
		       TO_CHAR(purchase_date, 'YYYY-MM-DD') as purchase_date, 
		       property_size_sqft, lot_size_acres, rental_income_monthly, 
		       property_tax_annual, notes, street_address, city, state, zip_code,
		       latitude, longitude, api_estimated_value, api_estimate_date, 
		       api_provider, created_at
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
			StreetAddress       *string  `json:"street_address"`
			City                *string  `json:"city"`
			State               *string  `json:"state"`
			ZipCode             *string  `json:"zip_code"`
			Latitude            *float64 `json:"latitude"`
			Longitude           *float64 `json:"longitude"`
			APIEstimatedValue   *float64 `json:"api_estimated_value"`
			APIEstimateDate     *string  `json:"api_estimate_date"`
			APIProvider         *string  `json:"api_provider"`
			CreatedAt           string   `json:"created_at"`
		}

		err := rows.Scan(
			&property.ID, &property.AccountID, &property.PropertyType, &property.PropertyName,
			&property.PurchasePrice, &property.CurrentValue, &property.OutstandingMortgage,
			&property.Equity, &property.PurchaseDate, &property.PropertySizeSqft,
			&property.LotSizeAcres, &property.RentalIncomeMonthly, &property.PropertyTaxAnnual,
			&property.Notes, &property.StreetAddress, &property.City, &property.State, 
			&property.ZipCode, &property.Latitude, &property.Longitude, 
			&property.APIEstimatedValue, &property.APIEstimateDate, &property.APIProvider,
			&property.CreatedAt,
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
			"street_address":        property.StreetAddress,
			"city":                  property.City,
			"state":                 property.State,
			"zip_code":              property.ZipCode,
			"latitude":              property.Latitude,
			"longitude":             property.Longitude,
			"api_estimated_value":   property.APIEstimatedValue,
			"api_estimate_date":     property.APIEstimateDate,
			"api_provider":          property.APIProvider,
			"created_at":            property.CreatedAt,
		}
		properties = append(properties, propertyMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"real_estate": properties,
	})
}

// @Summary Get cash holdings
// @Description Retrieve all cash account holdings including savings, checking, and money market accounts
// @Tags cash
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "List of cash holdings"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /cash-holdings [get]
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
			"id":                   holding.ID,
			"account_id":           holding.AccountID,
			"institution_name":     holding.InstitutionName,
			"account_name":         holding.AccountName,
			"account_type":         holding.AccountType,
			"current_balance":      holding.CurrentBalance,
			"interest_rate":        holding.InterestRate,
			"monthly_contribution": holding.MonthlyContribution,
			"account_number_last4": holding.AccountNumberLast4,
			"currency":             holding.Currency,
			"notes":                holding.Notes,
			"created_at":           holding.CreatedAt,
			"updated_at":           holding.UpdatedAt,
		}
		holdings = append(holdings, holdingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"cash_holdings": holdings,
	})
}

// @Summary Get cryptocurrency holdings
// @Description Retrieve all cryptocurrency holdings with current prices and values
// @Tags crypto
// @Accept json
// @Produce json
// @Success 200 {array} map[string]interface{} "List of cryptocurrency holdings"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto-holdings [get]
func (s *Server) getCryptoHoldings(c *gin.Context) {
	query := `
		SELECT ch.id, ch.account_id, ch.institution_name, ch.crypto_symbol, 
		       ch.balance_tokens, ch.purchase_price_usd, ch.purchase_date,
		       ch.wallet_address, ch.notes, ch.created_at, ch.updated_at,
		       cp.price_usd, cp.price_btc, cp.price_change_24h, cp.last_updated
		FROM crypto_holdings ch
		LEFT JOIN crypto_prices cp ON ch.crypto_symbol = cp.symbol
		AND cp.last_updated = (
			SELECT MAX(last_updated)
			FROM crypto_prices cp2
			WHERE cp2.symbol = ch.crypto_symbol
		)
		ORDER BY ch.institution_name, ch.crypto_symbol
	`

	rows, err := s.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch crypto holdings",
		})
		return
	}
	defer rows.Close()

	holdings := make([]map[string]interface{}, 0)
	for rows.Next() {
		var holding struct {
			ID               int      `json:"id"`
			AccountID        int      `json:"account_id"`
			InstitutionName  string   `json:"institution_name"`
			CryptoSymbol     string   `json:"crypto_symbol"`
			BalanceTokens    float64  `json:"balance_tokens"`
			PurchasePriceUSD *float64 `json:"purchase_price_usd"`
			PurchaseDate     *string  `json:"purchase_date"`
			WalletAddress    *string  `json:"wallet_address"`
			Notes            *string  `json:"notes"`
			CreatedAt        string   `json:"created_at"`
			UpdatedAt        string   `json:"updated_at"`
			PriceUSD         *float64 `json:"current_price_usd"`
			PriceBTC         *float64 `json:"current_price_btc"`
			PriceChange24h   *float64 `json:"price_change_24h"`
			PriceLastUpdated *string  `json:"price_last_updated"`
		}

		err := rows.Scan(
			&holding.ID, &holding.AccountID, &holding.InstitutionName, &holding.CryptoSymbol,
			&holding.BalanceTokens, &holding.PurchasePriceUSD, &holding.PurchaseDate,
			&holding.WalletAddress, &holding.Notes, &holding.CreatedAt, &holding.UpdatedAt,
			&holding.PriceUSD, &holding.PriceBTC, &holding.PriceChange24h, &holding.PriceLastUpdated,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan crypto holding",
			})
			return
		}

		// Calculate current value in USD
		var currentValueUSD *float64
		if holding.PriceUSD != nil {
			value := holding.BalanceTokens * *holding.PriceUSD
			currentValueUSD = &value
		}

		holdingMap := map[string]interface{}{
			"id":                   holding.ID,
			"account_id":           holding.AccountID,
			"institution_name":     holding.InstitutionName,
			"crypto_symbol":        holding.CryptoSymbol,
			"balance_tokens":       holding.BalanceTokens,
			"purchase_price_usd":   holding.PurchasePriceUSD,
			"purchase_date":        holding.PurchaseDate,
			"wallet_address":       holding.WalletAddress,
			"notes":                holding.Notes,
			"created_at":           holding.CreatedAt,
			"updated_at":           holding.UpdatedAt,
			"current_price_usd":    holding.PriceUSD,
			"current_price_btc":    holding.PriceBTC,
			"current_value_usd":    currentValueUSD,
			"price_change_24h":     holding.PriceChange24h,
			"price_last_updated":   holding.PriceLastUpdated,
		}
		holdings = append(holdings, holdingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"crypto_holdings": holdings,
	})
}

// @Summary Create new real estate property
// @Description Create a new real estate property record (placeholder - to be implemented)
// @Tags real-estate
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Property details including address, value, and mortgage info"
// @Success 201 {object} map[string]interface{} "Property created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /real-estate [post]
func (s *Server) createRealEstate(c *gin.Context) {
	// TODO: Implement real estate creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create real estate endpoint - to be implemented",
	})
}

// @Summary Update real estate property
// @Description Update an existing real estate property using the real estate plugin system
// @Tags real-estate
// @Accept json
// @Produce json
// @Param id path int true "Property ID"
// @Param request body map[string]interface{} true "Updated property details"
// @Success 200 {object} map[string]interface{} "Property updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 404 {object} map[string]interface{} "Property or plugin not found"
// @Router /real-estate/{id} [put]
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

// @Summary Delete real estate property
// @Description Delete a real estate property record (placeholder - to be implemented)
// @Tags real-estate
// @Accept json
// @Produce json
// @Param id path string true "Property ID"
// @Success 200 {object} map[string]interface{} "Property deleted successfully"
// @Failure 404 {object} map[string]interface{} "Property not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /real-estate/{id} [delete]
func (s *Server) deleteRealEstate(c *gin.Context) {
	id := c.Param("id")
	// TODO: Implement real estate deletion
	c.JSON(http.StatusOK, gin.H{
		"property_id": id,
		"message":     "Delete real estate endpoint - to be implemented",
	})
}

// Plugin handlers

// @Summary List all available plugins
// @Description Retrieve list of all available data source plugins with their status and capabilities
// @Tags plugins
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of available plugins with status"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /plugins [get]
func (s *Server) getPlugins(c *gin.Context) {
	plugins := s.pluginManager.ListPlugins()
	c.JSON(http.StatusOK, gin.H{
		"plugins": plugins,
		"count":   len(plugins),
	})
}

// @Summary Get plugin schema for manual entry
// @Description Retrieve the manual entry schema for a specific plugin to understand required fields
// @Tags plugins
// @Accept json
// @Produce json
// @Param name path string true "Plugin Name"
// @Success 200 {object} map[string]interface{} "Plugin manual entry schema"
// @Failure 400 {object} map[string]interface{} "Plugin does not support manual entry"
// @Failure 404 {object} map[string]interface{} "Plugin not found"
// @Router /plugins/{name}/schema [get]
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

// @Summary Process manual entry through plugin
// @Description Submit manual data entry to a specific plugin for processing and storage
// @Tags plugins
// @Accept json
// @Produce json
// @Param name path string true "Plugin Name"
// @Param request body map[string]interface{} true "Manual entry data matching plugin schema"
// @Success 200 {object} map[string]interface{} "Manual entry processed successfully"
// @Failure 400 {object} map[string]interface{} "Invalid data or plugin does not support manual entry"
// @Failure 404 {object} map[string]interface{} "Plugin not found"
// @Router /plugins/{name}/manual-entry [post]
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

// @Summary Refresh all plugin data
// @Description Trigger data refresh for all enabled plugins from their external sources
// @Tags plugins
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "All plugin data refreshed successfully"
// @Failure 500 {object} map[string]interface{} "Some plugins failed to refresh"
// @Router /plugins/refresh [post]
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

// @Summary Get plugin health status
// @Description Retrieve health status and diagnostic information for all plugins
// @Tags plugins
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Plugin health status information"
// @Failure 503 {object} map[string]interface{} "One or more plugins are unhealthy"
// @Router /plugins/health [get]
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

// @Summary Get all manual entries
// @Description Retrieve all manual data entries across all asset types with optional filtering by entry type
// @Tags manual-entries
// @Accept json
// @Produce json
// @Param type query string false "Filter by entry type (computershare, morgan_stanley, real_estate, etc.)"
// @Success 200 {object} map[string]interface{} "List of manual entries with metadata"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries [get]
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
		           'street_address', re.street_address,
		           'city', re.city,
		           'state', re.state,
		           'zip_code', re.zip_code,
		           'purchase_price', re.purchase_price,
		           'current_value', re.current_value,
		           'outstanding_mortgage', re.outstanding_mortgage,
		           'equity', re.equity,
		           'purchase_date', TO_CHAR(re.purchase_date, 'YYYY-MM-DD'),
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
		
		UNION ALL
		
		SELECT 'crypto_holdings' as entry_type,
		       cry.id, cry.account_id, cry.created_at, cry.updated_at,
		       json_build_object(
		           'institution_name', cry.institution_name,
		           'crypto_symbol', cry.crypto_symbol,
		           'balance_tokens', cry.balance_tokens,
		           'purchase_price_usd', cry.purchase_price_usd,
		           'purchase_date', cry.purchase_date,
		           'wallet_address', cry.wallet_address,
		           'notes', cry.notes
		       ) as data_json,
		       a.account_name, a.institution
		FROM crypto_holdings cry
		LEFT JOIN accounts a ON cry.account_id = a.id
		WHERE cry.created_at IS NOT NULL
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

// @Summary Create new manual entry
// @Description Create a new manual data entry using the appropriate plugin system
// @Tags manual-entries
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Manual entry data with entry type and values"
// @Success 201 {object} map[string]interface{} "Manual entry created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries [post]
func (s *Server) createManualEntry(c *gin.Context) {
	// TODO: Implement manual entry creation
	c.JSON(http.StatusCreated, gin.H{
		"message": "Create manual entry endpoint - to be implemented",
	})
}

// @Summary Update manual entry
// @Description Update an existing manual data entry by ID using the appropriate plugin
// @Tags manual-entries
// @Accept json
// @Produce json
// @Param id path int true "Manual Entry ID"
// @Param type query string true "Entry type for plugin selection"
// @Param request body map[string]interface{} true "Updated manual entry data"
// @Success 200 {object} map[string]interface{} "Manual entry updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 404 {object} map[string]interface{} "Manual entry or plugin not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries/{id} [put]
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

// @Summary Delete manual entry
// @Description Delete a manual data entry by ID and type from the appropriate data store
// @Tags manual-entries
// @Accept json
// @Produce json
// @Param id path int true "Manual Entry ID"
// @Param type query string true "Entry type (computershare, morgan_stanley, real_estate, cash_holdings, crypto_holdings)"
// @Success 200 {object} map[string]interface{} "Manual entry deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid entry type"
// @Failure 404 {object} map[string]interface{} "Manual entry not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries/{id} [delete]
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
	case "cash_holdings":
		query = "DELETE FROM cash_holdings WHERE id = $1"
	case "crypto_holdings":
		query = "DELETE FROM crypto_holdings WHERE id = $1"
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

// @Summary Get all manual entry schemas
// @Description Retrieve schemas for all plugins that support manual data entry
// @Tags manual-entries
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Manual entry schemas for all supported plugins"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries/schemas [get]
func (s *Server) getManualEntrySchemas(c *gin.Context) {
	schemas := s.pluginManager.GetManualEntrySchemas()
	c.JSON(http.StatusOK, gin.H{
		"schemas": schemas,
	})
}

// Price refresh handlers

// @Summary Refresh all stock prices
// @Description Trigger price refresh for all stock symbols from configured price provider
// @Tags prices
// @Accept json
// @Produce json
// @Param force query boolean false "Force refresh even if cache is recent"
// @Success 200 {object} map[string]interface{} "Price refresh completed successfully"
// @Failure 500 {object} map[string]interface{} "Internal server error during refresh"
// @Router /prices/refresh [post]
func (s *Server) refreshPrices(c *gin.Context) {
	startTime := time.Now()

	// Enhanced debugging - log full request details
	fmt.Printf("DEBUG: refreshPrices called - Method: %s, URL: %s, FullPath: %s\n", c.Request.Method, c.Request.URL.String(), c.FullPath())
	fmt.Printf("DEBUG: Query parameters: %v\n", c.Request.URL.Query())
	
	// Check for force refresh parameter
	forceRefresh := c.Query("force") == "true"
	fmt.Printf("DEBUG: force query param: '%s', forceRefresh: %t\n", c.Query("force"), forceRefresh)

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
	priceService := s.priceService

	// Track results
	var results []services.PriceUpdateResult
	updatedCount := 0
	failedCount := 0

	for _, symbol := range symbols {
		result := s.updateSymbolPrice(symbol, priceService, forceRefresh)
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

// @Summary Refresh specific symbol price
// @Description Trigger price refresh for a specific stock symbol from configured provider
// @Tags prices
// @Accept json
// @Produce json
// @Param symbol path string true "Stock Symbol (e.g., AAPL, MSFT)"
// @Param force query boolean false "Force refresh even if cache is recent"
// @Success 200 {object} map[string]interface{} "Symbol price refreshed successfully"
// @Failure 400 {object} map[string]interface{} "Invalid symbol or bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error during refresh"
// @Router /prices/refresh/{symbol} [post]
func (s *Server) refreshSymbolPrice(c *gin.Context) {
	symbol := strings.ToUpper(strings.TrimSpace(c.Param("symbol")))
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Symbol is required",
		})
		return
	}

	// Check for force refresh parameter
	forceRefresh := c.Query("force") == "true"

	priceService := s.priceService
	result := s.updateSymbolPrice(symbol, priceService, forceRefresh)

	status := http.StatusOK
	if !result.Updated {
		status = http.StatusInternalServerError
	}

	c.JSON(status, gin.H{
		"message": fmt.Sprintf("Price refresh for %s completed", symbol),
		"result":  result,
	})
}

// @Summary Get current price status
// @Description Retrieve current price cache status including stale count, last update time, and refresh recommendations
// @Tags prices
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Current price status and cache information"
// @Router /prices/status [get]
func (s *Server) getPricesStatus(c *gin.Context) {
	status := s.getPriceStatus()
	c.JSON(http.StatusOK, status)
}

// Market status endpoint

// @Summary Get current market status
// @Description Retrieve current stock market status (open/closed) and trading hours information
// @Tags market
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Current market status and trading hours"
// @Router /market/status [get]
func (s *Server) getMarketStatus(c *gin.Context) {
	status := s.marketService.GetMarketStatus()
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

func (s *Server) updateSymbolPrice(symbol string, priceService *services.PriceService, forceRefresh bool) services.PriceUpdateResult {
	result := services.PriceUpdateResult{
		Symbol:    symbol,
		Updated:   false,
		Timestamp: time.Now(),
	}

	// Get current price from service
	newPrice, err := priceService.GetCurrentPriceWithForce(symbol, forceRefresh)
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

// Crypto price handlers

// @Summary Get current crypto price
// @Description Retrieve current price information for a specific cryptocurrency symbol
// @Tags crypto
// @Accept json
// @Produce json
// @Param symbol path string true "Cryptocurrency Symbol (e.g., BTC, ETH, ADA)"
// @Success 200 {object} map[string]interface{} "Current cryptocurrency price data"
// @Failure 400 {object} map[string]interface{} "Bad request - symbol required"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto/prices/{symbol} [get]
func (s *Server) getCryptoPrice(c *gin.Context) {
	symbol := c.Param("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Symbol parameter is required",
		})
		return
	}

	price, err := s.cryptoService.GetPrice(symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to get price for %s: %v", symbol, err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"symbol":           price.Symbol,
		"price_usd":        price.PriceUSD,
		"price_btc":        price.PriceBTC,
		"market_cap_usd":   price.MarketCapUSD,
		"volume_24h_usd":   price.Volume24hUSD,
		"price_change_24h": price.PriceChange24h,
		"last_updated":     price.LastUpdated.Format(time.RFC3339),
	})
}

// @Summary Refresh all crypto prices
// @Description Trigger price refresh for all cryptocurrency holdings from external price provider
// @Tags crypto
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "All crypto prices refreshed successfully"
// @Failure 500 {object} map[string]interface{} "Internal server error during refresh"
// @Router /crypto/prices/refresh [post]
func (s *Server) refreshCryptoPrices(c *gin.Context) {
	err := s.cryptoService.RefreshAllCryptoPrices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to refresh crypto prices: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Crypto prices refreshed successfully",
	})
}

// @Summary Refresh specific crypto price
// @Description Trigger price refresh for a specific cryptocurrency symbol
// @Tags crypto
// @Accept json
// @Produce json
// @Param symbol path string true "Cryptocurrency Symbol (e.g., BTC, ETH, ADA)"
// @Success 200 {object} map[string]interface{} "Crypto price refreshed successfully with updated data"
// @Failure 400 {object} map[string]interface{} "Bad request - symbol required"
// @Failure 500 {object} map[string]interface{} "Internal server error during refresh"
// @Router /crypto/prices/refresh/{symbol} [post]
func (s *Server) refreshCryptoPrice(c *gin.Context) {
	symbol := c.Param("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Symbol parameter is required",
		})
		return
	}

	price, err := s.cryptoService.GetPrice(symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to refresh price for %s: %v", symbol, err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Price refreshed for %s", symbol),
		"symbol":           price.Symbol,
		"price_usd":        price.PriceUSD,
		"price_btc":        price.PriceBTC,
		"market_cap_usd":   price.MarketCapUSD,
		"volume_24h_usd":   price.Volume24hUSD,
		"price_change_24h": price.PriceChange24h,
		"last_updated":     price.LastUpdated.Format(time.RFC3339),
	})
}

// @Summary Get crypto price history
// @Description Retrieve historical price data for all cryptocurrencies with optional date range filtering
// @Tags crypto
// @Accept json
// @Produce json
// @Param days query int false "Number of days of history to retrieve (default: 30, max: 365)"
// @Success 200 {object} map[string]interface{} "Historical cryptocurrency price data grouped by symbol"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto/prices/history [get]
func (s *Server) getCryptoPriceHistory(c *gin.Context) {
	// Optional query parameters for filtering
	daysBack := c.DefaultQuery("days", "30") // Default to last 30 days
	
	// Parse days parameter
	days := 30
	if daysBack != "" {
		if parsedDays, err := strconv.Atoi(daysBack); err == nil && parsedDays > 0 && parsedDays <= 365 {
			days = parsedDays
		}
	}

	// Calculate start date
	startDate := time.Now().AddDate(0, 0, -days)

	query := `
		SELECT symbol, price_usd, price_btc, last_updated
		FROM crypto_prices 
		WHERE last_updated >= $1
		ORDER BY symbol, last_updated
	`

	rows, err := s.db.Query(query, startDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch crypto price history",
		})
		return
	}
	defer rows.Close()

	// Group data by symbol
	historyMap := make(map[string][]map[string]interface{})
	
	for rows.Next() {
		var symbol string
		var priceUSD, priceBTC float64
		var lastUpdated time.Time

		err := rows.Scan(&symbol, &priceUSD, &priceBTC, &lastUpdated)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan price history data",
			})
			return
		}

		dataPoint := map[string]interface{}{
			"timestamp":  lastUpdated.Format(time.RFC3339),
			"price_usd":  priceUSD,
			"price_btc":  priceBTC,
		}

		historyMap[symbol] = append(historyMap[symbol], dataPoint)
	}

	// Convert to array format
	var history []map[string]interface{}
	for symbol, data := range historyMap {
		history = append(history, map[string]interface{}{
			"symbol": symbol,
			"data":   data,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"price_history": history,
		"start_date":    startDate.Format(time.RFC3339),
		"days_back":     days,
		"total_symbols": len(history),
		"disclaimer":    "This data represents cached price snapshots taken during application usage and may not reflect complete or real-time market data.",
	})
}

// Property valuation handlers

// @Summary Get property valuation
// @Description Retrieve current property valuation estimate by address components
// @Tags property-valuation
// @Accept json
// @Produce json
// @Param address query string false "Street address"
// @Param city query string false "City name"
// @Param state query string false "State abbreviation"
// @Param zip_code query string false "ZIP/postal code"
// @Success 200 {object} map[string]interface{} "Property valuation data including estimated value and details"
// @Failure 400 {object} map[string]interface{} "Bad request - at least one address component required"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "Property valuation feature disabled"
// @Router /property-valuation [get]
func (s *Server) getPropertyValuation(c *gin.Context) {
	// Check if property valuation feature is enabled
	if !s.propertyValuationService.IsPropertyValuationEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Property valuation feature is currently disabled",
			"feature_enabled": false,
		})
		return
	}
	
	address := c.Query("address")
	city := c.Query("city")
	state := c.Query("state")
	zipCode := c.Query("zip_code")
	
	// At least one parameter is required
	if address == "" && city == "" && state == "" && zipCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one address component is required (address, city, state, or zip_code)",
		})
		return
	}
	
	valuation, err := s.propertyValuationService.GetPropertyValuation(address, city, state, zipCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to get property valuation: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, valuation)
}

// @Summary Refresh property valuation
// @Description Force refresh property valuation from external data sources
// @Tags property-valuation
// @Accept json
// @Produce json
// @Param address query string false "Street address"
// @Param city query string false "City name"
// @Param state query string false "State abbreviation"
// @Param zip_code query string false "ZIP/postal code"
// @Success 200 {object} map[string]interface{} "Property valuation refreshed successfully"
// @Failure 400 {object} map[string]interface{} "Bad request - at least one address component required"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "Property valuation feature disabled"
// @Router /property-valuation/refresh [post]
func (s *Server) refreshPropertyValuation(c *gin.Context) {
	// Check if property valuation feature is enabled
	if !s.propertyValuationService.IsPropertyValuationEnabled() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Property valuation feature is currently disabled",
			"feature_enabled": false,
		})
		return
	}
	
	address := c.Query("address")
	city := c.Query("city")
	state := c.Query("state")
	zipCode := c.Query("zip_code")
	
	// At least one parameter is required
	if address == "" && city == "" && state == "" && zipCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one address component is required (address, city, state, or zip_code)",
		})
		return
	}
	
	valuation, err := s.propertyValuationService.RefreshPropertyValuation(address, city, state, zipCode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to refresh property valuation: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Property valuation refreshed successfully",
		"valuation": valuation,
	})
}

// @Summary Get property valuation providers
// @Description Retrieve list of available property valuation providers and their status
// @Tags property-valuation
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "List of available valuation providers with availability status"
// @Router /property-valuation/providers [get]
func (s *Server) getPropertyValuationProviders(c *gin.Context) {
	// Check if property valuation feature is enabled
	if !s.propertyValuationService.IsPropertyValuationEnabled() {
		c.JSON(http.StatusOK, gin.H{
			"providers": []gin.H{
				{
					"name": "Manual Entry",
					"available": true,
					"description": "Manual property value entry (external APIs disabled)",
				},
			},
			"active_provider": "Manual Entry",
			"feature_enabled": false,
			"message": "Property valuation feature is disabled",
		})
		return
	}
	
	providers := []gin.H{
		{
			"name": "Manual Entry",
			"available": true,
			"description": "Manual property value entry",
		},
	}
	
	if s.propertyValuationService.IsAttomDataAvailable() {
		providers = append(providers, gin.H{
			"name": "ATTOM Data API",
			"available": true,
			"description": "Professional property data and valuation from ATTOM Data",
		})
	} else {
		providers = append(providers, gin.H{
			"name": "ATTOM Data API",
			"available": false,
			"description": "Professional property data and valuation from ATTOM Data (API key required or feature disabled)",
		})
	}
	
	c.JSON(http.StatusOK, gin.H{
		"providers": providers,
		"active_provider": s.propertyValuationService.GetProviderName(),
		"feature_enabled": true,
	})
}
