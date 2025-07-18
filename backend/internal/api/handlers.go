package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"networth-dashboard/internal/plugins"
	"networth-dashboard/internal/services"

	"github.com/gin-gonic/gin"
)

// Placeholder handlers - will be implemented in future phases

// Net worth handlers

// @Summary Get current net worth
// @Description Calculate and return current net worth including all assets (stocks, equity, real estate, cash, crypto, other assets) minus liabilities
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

	// Calculate other assets value (equity = value - amount owed)
	otherAssetsValue := s.calculateOtherAssetsValue()

	// Calculate liabilities
	totalLiabilities := s.calculateTotalLiabilities()

	// Net worth = only vested/liquid assets - liabilities
	totalAssets := stockValue + vestedEquityValue + realEstateEquity + cashHoldingsValue + cryptoHoldingsValue + otherAssetsValue
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
		"crypto_holdings_value": cryptoHoldingsValue,
		"other_assets_value":    otherAssetsValue,
		"price_last_updated":    priceStatus.LastUpdated,
		"stale_price_count":     priceStatus.StaleCount,
		"provider_name":         priceStatus.ProviderName,
		"last_updated":          time.Now().Format(time.RFC3339),
	}
	c.JSON(http.StatusOK, data)
}

// Helper functions for net worth calculation
func (s *Server) calculateStockHoldingsValue() float64 {
	var stockValue float64
	query := `
		SELECT COALESCE(SUM(shares_owned * COALESCE(current_price, 0)), 0) 
		FROM stock_holdings
		WHERE current_price > 0 AND COALESCE(is_vested_equity, false) = false
	`
	err := s.db.QueryRow(query).Scan(&stockValue)
	if err != nil {
		stockValue = 0.0
	}

	// Add brokerage account values from cash_holdings
	var brokerageValue float64
	brokerageQuery := `
		SELECT COALESCE(SUM(current_balance), 0) 
		FROM cash_holdings
		WHERE account_type = 'brokerage'
	`
	err = s.db.QueryRow(brokerageQuery).Scan(&brokerageValue)
	if err != nil {
		brokerageValue = 0.0
	}

	return stockValue + brokerageValue
}

func (s *Server) calculateVestedEquityValue() float64 {
	// Calculate value from equity grants (traditional vested shares)
	var equityGrantsValue float64
	query := `
		SELECT COALESCE(SUM(vested_shares * COALESCE(current_price, 0)), 0) 
		FROM equity_grants 
		WHERE current_price > 0 AND vested_shares > 0
	`
	err := s.db.QueryRow(query).Scan(&equityGrantsValue)
	if err != nil {
		equityGrantsValue = 0.0
	}

	// Calculate value from stock holdings marked as vested equity
	var vestedStockValue float64
	vestedStockQuery := `
		SELECT COALESCE(SUM(shares_owned * COALESCE(current_price, 0)), 0) 
		FROM stock_holdings 
		WHERE current_price > 0 AND COALESCE(is_vested_equity, false) = true
	`
	err = s.db.QueryRow(vestedStockQuery).Scan(&vestedStockValue)
	if err != nil {
		vestedStockValue = 0.0
	}

	return equityGrantsValue + vestedStockValue
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
	var cashHoldingsValue float64
	
	// Get value from cash_holdings table (includes both manually entered and imported accounts)
	cashQuery := `
		SELECT COALESCE(SUM(current_balance), 0) 
		FROM cash_holdings
		WHERE account_type != 'brokerage'
	`
	err := s.db.QueryRow(cashQuery).Scan(&cashHoldingsValue)
	if err != nil {
		cashHoldingsValue = 0.0
	}
	
	log.Printf("Cash holdings calculation - Total: %f (includes both manual and imported accounts)", cashHoldingsValue)
	
	return cashHoldingsValue
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

func (s *Server) calculateOtherAssetsValue() float64 {
	var value float64
	query := `
		SELECT COALESCE(SUM(current_value - COALESCE(amount_owed, 0)), 0)
		FROM miscellaneous_assets
	`
	err := s.db.QueryRow(query).Scan(&value)
	if err != nil {
		return 0.0
	}
	return value
}

func (s *Server) calculateTotalLiabilities() float64 {
	// Note: Real estate mortgages are NOT included here because
	// real estate equity is already calculated net of mortgages
	// (equity = current_value - outstanding_mortgage)
	//
	// This function should include other types of liabilities like:
	// - Credit card debt
	// - Personal loans
	// - Student loans
	// - Other debts not secured by assets already counted as equity
	//
	// For now, returning 0 since we don't have other liability types implemented
	// and real estate mortgages are already accounted for in the equity calculation

	return 0.0
}

// @Summary Get passive income breakdown
// @Description Calculate and return monthly passive income from various sources including dividends, interest, and rental income
// @Tags passive-income
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Monthly passive income breakdown with pie chart data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /passive-income [get]
func (s *Server) getPassiveIncome(c *gin.Context) {
	// Calculate passive income from different sources

	// 1. Cash holdings interest (monthly)
	cashInterestMonthly := s.calculateCashInterestMonthly()

	// 2. Stock dividends (monthly average from quarterly)
	stockDividendsMonthly := s.calculateStockDividendsMonthly()

	// 3. Real estate rental income (already monthly)
	realEstateIncomeMonthly := s.calculateRealEstateIncomeMonthly()

	// 4. Crypto staking income (monthly)
	cryptoStakingMonthly := s.calculateCryptoStakingMonthly()

	// Calculate total monthly passive income
	totalMonthly := cashInterestMonthly + stockDividendsMonthly + realEstateIncomeMonthly + cryptoStakingMonthly

	// Create income source breakdown for pie chart
	incomeBreakdown := []gin.H{}

	if cashInterestMonthly > 0 {
		incomeBreakdown = append(incomeBreakdown, gin.H{
			"source":         "Cash Interest",
			"monthly_amount": cashInterestMonthly,
			"annual_amount":  cashInterestMonthly * 12,
			"percentage":     (cashInterestMonthly / totalMonthly) * 100,
		})
	}

	if stockDividendsMonthly > 0 {
		incomeBreakdown = append(incomeBreakdown, gin.H{
			"source":         "Stock Dividends",
			"monthly_amount": stockDividendsMonthly,
			"annual_amount":  stockDividendsMonthly * 12,
			"percentage":     (stockDividendsMonthly / totalMonthly) * 100,
		})
	}

	if realEstateIncomeMonthly > 0 {
		incomeBreakdown = append(incomeBreakdown, gin.H{
			"source":         "Real Estate",
			"monthly_amount": realEstateIncomeMonthly,
			"annual_amount":  realEstateIncomeMonthly * 12,
			"percentage":     (realEstateIncomeMonthly / totalMonthly) * 100,
		})
	}

	if cryptoStakingMonthly > 0 {
		incomeBreakdown = append(incomeBreakdown, gin.H{
			"source":         "Crypto Staking",
			"monthly_amount": cryptoStakingMonthly,
			"annual_amount":  cryptoStakingMonthly * 12,
			"percentage":     (cryptoStakingMonthly / totalMonthly) * 100,
		})
	}

	data := gin.H{
		"total_monthly_income": totalMonthly,
		"total_annual_income":  totalMonthly * 12,
		"income_breakdown":     incomeBreakdown,
		"summary": gin.H{
			"cash_interest_monthly":      cashInterestMonthly,
			"stock_dividends_monthly":    stockDividendsMonthly,
			"real_estate_income_monthly": realEstateIncomeMonthly,
			"crypto_staking_monthly":     cryptoStakingMonthly,
		},
		"last_updated": time.Now().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, data)
}

// Helper functions for passive income calculation
func (s *Server) calculateCashInterestMonthly() float64 {
	var totalInterest float64
	query := `
		SELECT COALESCE(SUM(current_balance * COALESCE(interest_rate, 0) / 100 / 12), 0)
		FROM cash_holdings
		WHERE account_type != 'brokerage' AND interest_rate > 0
	`
	err := s.db.QueryRow(query).Scan(&totalInterest)
	if err != nil {
		return 0.0
	}
	return totalInterest
}

func (s *Server) calculateStockDividendsMonthly() float64 {
	var totalDividends float64
	query := `
		SELECT COALESCE(SUM(shares_owned * COALESCE(estimated_quarterly_dividend, 0) / 3), 0)
		FROM stock_holdings
		WHERE estimated_quarterly_dividend > 0
	`
	err := s.db.QueryRow(query).Scan(&totalDividends)
	if err != nil {
		return 0.0
	}
	return totalDividends
}

func (s *Server) calculateRealEstateIncomeMonthly() float64 {
	var totalRentalIncome float64
	query := `
		SELECT COALESCE(SUM(rental_income_monthly), 0)
		FROM real_estate_properties
		WHERE rental_income_monthly > 0
	`
	err := s.db.QueryRow(query).Scan(&totalRentalIncome)
	if err != nil {
		return 0.0
	}
	return totalRentalIncome
}

func (s *Server) calculateCryptoStakingMonthly() float64 {
	var totalStakingIncome float64

	// Calculation: (balance_tokens * price_usd * staking_annual_percentage / 100 / 12)
	// Example: 10 ETH * $3,400 * 3.43% / 12 = $34,000 * 0.0343 / 12 = $97.27/month

	// Debug query to show individual calculations
	debugQuery := `
		SELECT ch.crypto_symbol, ch.balance_tokens, COALESCE(cp.price_usd, 0) as price_usd, 
		       ch.staking_annual_percentage,
		       (ch.balance_tokens * COALESCE(cp.price_usd, 0) * ch.staking_annual_percentage / 100 / 12) as monthly_income
		FROM crypto_holdings ch
		LEFT JOIN crypto_prices cp ON ch.crypto_symbol = cp.symbol
		AND cp.last_updated = (
			SELECT MAX(last_updated)
			FROM crypto_prices cp2
			WHERE cp2.symbol = ch.crypto_symbol
		)
		WHERE ch.staking_annual_percentage > 0
	`

	// Log debug information
	rows, err := s.db.Query(debugQuery)
	if err == nil {
		defer rows.Close()
		fmt.Printf("DEBUG: Crypto staking calculations:\n")
		for rows.Next() {
			var symbol string
			var tokens, price, percentage, monthlyIncome float64
			if err := rows.Scan(&symbol, &tokens, &price, &percentage, &monthlyIncome); err == nil {
				fmt.Printf("  %s: %.6f tokens * $%.2f * %.2f%% / 12 = $%.2f/month\n",
					symbol, tokens, price, percentage, monthlyIncome)
			}
		}
	}

	// Main calculation query
	query := `
		SELECT COALESCE(SUM(
			ch.balance_tokens * COALESCE(cp.price_usd, 0) * ch.staking_annual_percentage / 100 / 12
		), 0)
		FROM crypto_holdings ch
		LEFT JOIN crypto_prices cp ON ch.crypto_symbol = cp.symbol
		AND cp.last_updated = (
			SELECT MAX(last_updated)
			FROM crypto_prices cp2
			WHERE cp2.symbol = ch.crypto_symbol
		)
		WHERE ch.staking_annual_percentage > 0
	`
	err = s.db.QueryRow(query).Scan(&totalStakingIncome)
	if err != nil {
		return 0.0
	}

	fmt.Printf("DEBUG: Total crypto staking monthly income: $%.2f\n", totalStakingIncome)
	return totalStakingIncome
}

// PriceStatus represents the current status of price data
type PriceStatus struct {
	LastUpdated        string `json:"last_updated"`
	StaleCount         int    `json:"stale_count"`
	TotalCount         int    `json:"total_count"`
	ProviderName       string `json:"provider_name"`
	CacheStale         bool   `json:"cache_stale"`
	ForceRefreshNeeded bool   `json:"force_refresh_needed"`
	LastCacheUpdate    string `json:"last_cache_update,omitempty"`
	CacheAgeMinutes    int    `json:"cache_age_minutes"`
	MarketOpen         bool   `json:"market_open"`
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
		LastUpdated:        now.Format(time.RFC3339),
		StaleCount:         staleCount,
		TotalCount:         totalCount,
		ProviderName:       priceService.GetProviderName(),
		CacheStale:         cacheStale,
		ForceRefreshNeeded: forceRefreshNeeded,
		LastCacheUpdate:    lastCacheUpdateStr,
		CacheAgeMinutes:    cacheAgeMinutes,
		MarketOpen:         isMarketOpen,
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
// DEPRECATED: This function is no longer used in the new architecture
// Account information is now stored directly in asset tables (cash_holdings, stock_holdings, etc.)
// Use the specific asset endpoints instead
func (s *Server) getAccounts(c *gin.Context) {
	c.JSON(http.StatusGone, gin.H{
		"error": "Accounts endpoint is deprecated - use specific asset endpoints (cash-holdings, stock-holdings, etc.)",
		"message": "The centralized accounts table has been deprecated. Account information is now stored directly in asset-specific tables.",
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
		SELECT h.id, h.symbol, h.company_name, h.shares_owned, 
		       h.cost_basis, h.current_price, h.institution_name, h.data_source, h.created_at,
		       COALESCE(h.shares_owned * h.current_price, 0) as market_value,
		       h.estimated_quarterly_dividend, h.purchase_date, h.drip_enabled, h.last_manual_update,
		       COALESCE(h.is_vested_equity, false) as is_vested_equity
		FROM stock_holdings h
		ORDER BY h.institution_name, h.symbol
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
			ID                         int      `json:"id"`
			Symbol                     string   `json:"symbol"`
			CompanyName                *string  `json:"company_name"`
			SharesOwned                float64  `json:"shares_owned"`
			CostBasis                  *float64 `json:"cost_basis"`
			CurrentPrice               *float64 `json:"current_price"`
			InstitutionName            string   `json:"institution_name"`
			MarketValue                float64  `json:"market_value"`
			DataSource                 string   `json:"data_source"`
			CreatedAt                  string   `json:"created_at"`
			EstimatedQuarterlyDividend *float64 `json:"estimated_quarterly_dividend"`
			PurchaseDate               *string  `json:"purchase_date"`
			DripEnabled                *string  `json:"drip_enabled"`
			LastManualUpdate           *string  `json:"last_manual_update"`
			IsVestedEquity             bool     `json:"is_vested_equity"`
		}

		err := rows.Scan(
			&holding.ID, &holding.Symbol, &holding.CompanyName,
			&holding.SharesOwned, &holding.CostBasis, &holding.CurrentPrice,
			&holding.InstitutionName, &holding.DataSource, &holding.CreatedAt, &holding.MarketValue,
			&holding.EstimatedQuarterlyDividend, &holding.PurchaseDate, &holding.DripEnabled, &holding.LastManualUpdate,
			&holding.IsVestedEquity,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan stock holding",
			})
			return
		}

		holdingMap := map[string]interface{}{
			"id":                           holding.ID,
			"symbol":                       holding.Symbol,
			"company_name":                 holding.CompanyName,
			"shares_owned":                 holding.SharesOwned,
			"cost_basis":                   holding.CostBasis,
			"current_price":                holding.CurrentPrice,
			"institution_name":             holding.InstitutionName,
			"market_value":                 holding.MarketValue,
			"data_source":                  holding.DataSource,
			"created_at":                   holding.CreatedAt,
			"estimated_quarterly_dividend": holding.EstimatedQuarterlyDividend,
			"purchase_date":                holding.PurchaseDate,
			"drip_enabled":                 holding.DripEnabled,
			"last_manual_update":           holding.LastManualUpdate,
			"is_vested_equity":             holding.IsVestedEquity,
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
			SELECT id, shares_owned, cost_basis, data_source, created_at, 'direct_stock' as source_type, NULL as grant_type
			FROM stock_holdings 
			WHERE symbol = $1 AND shares_owned > 0
			
			UNION ALL
			
			SELECT id, vested_shares as shares_owned, 
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
				SharesOwned float64  `json:"shares_owned"`
				CostBasis   *float64 `json:"cost_basis"`
				DataSource  string   `json:"data_source"`
				CreatedAt   string   `json:"created_at"`
				SourceType  string   `json:"source_type"`
				GrantType   *string  `json:"grant_type"`
			}

			err := sourceRows.Scan(
				&source.ID, &source.SharesOwned,
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
// @Description Create a new stock holding using the stock holdings plugin
// @Tags stocks
// @Accept json
// @Produce json
// @Success 201 {object} map[string]interface{} "Stock holding created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks [post]
func (s *Server) createStockHolding(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Get the stock holdings plugin
	plugin, err := s.pluginManager.GetPlugin("stock_holding")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Stock holdings plugin not found",
		})
		return
	}

	manualPlugin, ok := plugin.(interface {
		ProcessManualEntry(data map[string]interface{}) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Process the manual entry
	err = manualPlugin.ProcessManualEntry(requestData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to create stock holding: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Stock holding created successfully",
	})
}

// @Summary Update stock holding
// @Description Update an existing stock holding record (placeholder - to be implemented)
// @Tags stocks
// @Accept json
// @Produce json
// @Param id path string true "Stock Holding ID"
// @Success 200 {object} map[string]interface{} "Stock holding updated successfully"
// @Summary Update stock holding
// @Description Update an existing stock holding record
// @Tags stocks
// @Accept json
// @Produce json
// @Param id path int true "Stock holding ID"
// @Param holding body map[string]interface{} true "Stock holding data"
// @Success 200 {object} map[string]interface{} "Updated stock holding"
// @Failure 400 {object} map[string]interface{} "Invalid request"
// @Failure 404 {object} map[string]interface{} "Stock holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks/{id} [put]
func (s *Server) updateStockHolding(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid stock holding ID"})
		return
	}

	var updateData map[string]interface{}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON data"})
		return
	}

	// Get the stock holding plugin
	plugin, err := s.pluginManager.GetPlugin("stock_holding")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Stock holding plugin not available"})
		return
	}

	stockPlugin, ok := plugin.(*plugins.StockHoldingPlugin)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid plugin type"})
		return
	}

	// Validate the data
	validation := stockPlugin.ValidateManualEntry(updateData)
	if !validation.Valid {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "Validation failed",
			"validation_errors": validation.Errors,
		})
		return
	}

	// Update the stock holding
	err = stockPlugin.UpdateManualEntry(id, validation.Data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update stock holding: %v", err)})
		return
	}

	// Return updated stock holding
	c.JSON(http.StatusOK, gin.H{
		"message":  "Stock holding updated successfully",
		"stock_id": id,
	})
}

// @Summary Delete stock holding
// @Description Delete an existing stock holding by ID
// @Tags stocks
// @Accept json
// @Produce json
// @Param id path int true "Stock Holding ID"
// @Success 200 {object} map[string]interface{} "Stock holding deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid ID"
// @Failure 404 {object} map[string]interface{} "Stock holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /stocks/{id} [delete]
func (s *Server) deleteStockHolding(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Stock holding ID is required",
		})
		return
	}

	// Delete the stock holding record
	query := `DELETE FROM stock_holdings WHERE id = $1`
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete stock holding",
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
			"error": "Stock holding not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stock holding deleted successfully",
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
		SELECT id, grant_type, company_symbol, total_shares, 
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
			&grant.ID, &grant.GrantType, &grant.CompanySymbol,
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
	var request struct {
		GrantType     string  `json:"grant_type" binding:"required"`
		CompanySymbol string  `json:"company_symbol" binding:"required"`
		TotalShares   float64 `json:"total_shares" binding:"required"`
		VestedShares  float64 `json:"vested_shares"`
		StrikePrice   float64 `json:"strike_price"`
		GrantDate     string  `json:"grant_date" binding:"required"`
		VestStartDate string  `json:"vest_start_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Calculate unvested shares
	unvestedShares := request.TotalShares - request.VestedShares

	// Get current market price
	currentPrice, priceErr := s.priceService.GetCurrentPrice(request.CompanySymbol)
	if priceErr != nil {
		// Log error but continue with 0 price
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", request.CompanySymbol, priceErr)
		currentPrice = 0
	}

	// Insert equity grant
	query := `
		INSERT INTO equity_grants (
			grant_type, company_symbol, total_shares, vested_shares, 
			unvested_shares, strike_price, grant_date, vest_start_date, 
			current_price, data_source, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id
	`

	var grantID int
	err := s.db.QueryRow(
		query,
		request.GrantType, request.CompanySymbol,
		request.TotalShares, request.VestedShares, unvestedShares,
		request.StrikePrice, request.GrantDate, request.VestStartDate,
		currentPrice, "manual", time.Now(),
	).Scan(&grantID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create equity grant",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      grantID,
		"message": "Equity grant created successfully",
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
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Equity grant ID is required",
		})
		return
	}

	var request struct {
		GrantType     string  `json:"grant_type" binding:"required"`
		CompanySymbol string  `json:"company_symbol" binding:"required"`
		TotalShares   float64 `json:"total_shares" binding:"required"`
		VestedShares  float64 `json:"vested_shares"`
		StrikePrice   float64 `json:"strike_price"`
		GrantDate     string  `json:"grant_date" binding:"required"`
		VestStartDate string  `json:"vest_start_date" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Calculate unvested shares
	unvestedShares := request.TotalShares - request.VestedShares

	// Get current market price
	currentPrice, priceErr := s.priceService.GetCurrentPrice(request.CompanySymbol)
	if priceErr != nil {
		// Log error but continue with existing price
		fmt.Printf("Warning: Could not fetch price for %s: %v\n", request.CompanySymbol, priceErr)
		// Get existing price from database
		var existingPrice float64
		priceQuery := "SELECT COALESCE(current_price, 0) FROM equity_grants WHERE id = $1"
		s.db.QueryRow(priceQuery, id).Scan(&existingPrice)
		currentPrice = existingPrice
	}

	// Update equity grant
	query := `
		UPDATE equity_grants 
		SET grant_type = $1, company_symbol = $2, total_shares = $3, 
		    vested_shares = $4, unvested_shares = $5, strike_price = $6, current_price = $7, 
		    grant_date = $8, vest_start_date = $9, updated_at = $10
		WHERE id = $11
	`

	result, err := s.db.Exec(
		query,
		request.GrantType, request.CompanySymbol,
		request.TotalShares, request.VestedShares, unvestedShares,
		request.StrikePrice, currentPrice, request.GrantDate, request.VestStartDate,
		time.Now(), id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update equity grant",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check update result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Equity grant not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Equity grant updated successfully",
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
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Equity grant ID is required",
		})
		return
	}

	// Delete the equity grant record
	query := `DELETE FROM equity_grants WHERE id = $1`
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete equity grant",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check delete result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Equity grant not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"grant_id": id,
		"message":  "Equity grant deleted successfully",
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
		SELECT id, property_type, property_name, purchase_price, 
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
			&property.ID, &property.PropertyType, &property.PropertyName,
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
		SELECT id, institution_name, account_name, account_type, 
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
			&holding.ID, &holding.InstitutionName, &holding.AccountName,
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

// @Summary Create cash holding
// @Description Create a new cash holding using the cash holdings plugin
// @Tags cash-holdings
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Cash holding details"
// @Success 201 {object} map[string]interface{} "Cash holding created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /cash-holdings [post]
func (s *Server) createCashHolding(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Get the cash holdings plugin
	plugin, err := s.pluginManager.GetPlugin("cash_holdings")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cash holdings plugin not found",
		})
		return
	}

	manualPlugin, ok := plugin.(interface {
		ProcessManualEntry(data map[string]interface{}) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Process the manual entry
	err = manualPlugin.ProcessManualEntry(requestData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to create cash holding: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Cash holding created successfully",
	})
}

// @Summary Update cash holding
// @Description Update an existing cash holding using the cash holdings plugin
// @Tags cash-holdings
// @Accept json
// @Produce json
// @Param id path int true "Cash holding ID"
// @Param request body map[string]interface{} true "Updated cash holding details"
// @Success 200 {object} map[string]interface{} "Cash holding updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 404 {object} map[string]interface{} "Cash holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /cash-holdings/{id} [put]
func (s *Server) updateCashHolding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid cash holding ID",
		})
		return
	}

	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Get the cash holdings plugin
	plugin, err := s.pluginManager.GetPlugin("cash_holdings")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cash holdings plugin not found",
		})
		return
	}

	manualPlugin, ok := plugin.(interface {
		UpdateManualEntry(id int, data map[string]interface{}) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Update the manual entry
	err = manualPlugin.UpdateManualEntry(id, requestData)
	if err != nil {
		if strings.Contains(err.Error(), "no cash holding found") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Cash holding not found",
			})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Failed to update cash holding: %v", err),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cash holding updated successfully",
	})
}

// @Summary Bulk update cash holdings
// @Description Update multiple cash holdings in a single transaction
// @Tags cash-holdings
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Bulk update request with updates array"
// @Success 200 {object} map[string]interface{} "Bulk update results"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /cash-holdings/bulk [put]
func (s *Server) bulkUpdateCashHoldings(c *gin.Context) {
	var requestData struct {
		Updates []struct {
			ID      int                    `json:"id"`
			Changes map[string]interface{} `json:"changes"`
		} `json:"updates"`
	}

	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	if len(requestData.Updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No updates provided",
		})
		return
	}

	// Get the cash holdings plugin
	plugin, err := s.pluginManager.GetPlugin("cash_holdings")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Cash holdings plugin not found",
		})
		return
	}

	// Check if plugin supports bulk updates
	bulkPlugin, ok := plugin.(interface {
		BulkUpdateManualEntry(updates []plugins.BulkUpdateItem) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support bulk updates",
		})
		return
	}

	// Convert request data to plugin format
	bulkUpdates := make([]plugins.BulkUpdateItem, len(requestData.Updates))
	for i, update := range requestData.Updates {
		bulkUpdates[i] = plugins.BulkUpdateItem{
			ID:   update.ID,
			Data: update.Changes,
		}
	}

	// Perform bulk update
	err = bulkPlugin.BulkUpdateManualEntry(bulkUpdates)
	if err != nil {
		// Check if it's a bulk update result with partial failures
		if bulkResult, ok := err.(*plugins.BulkUpdateResult); ok {
			c.JSON(http.StatusOK, gin.H{
				"success_count": bulkResult.SuccessCount,
				"failure_count": bulkResult.FailureCount,
				"errors":        bulkResult.Errors,
				"message":       "Bulk update completed with some failures",
			})
			return
		}

		// Regular error
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Bulk update failed: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success_count": len(requestData.Updates),
		"failure_count": 0,
		"message":       "All cash holdings updated successfully",
	})
}

// @Summary Delete cash holding
// @Description Delete an existing cash holding
// @Tags cash-holdings
// @Accept json
// @Produce json
// @Param id path int true "Cash holding ID"
// @Success 200 {object} map[string]interface{} "Cash holding deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid ID"
// @Failure 404 {object} map[string]interface{} "Cash holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /cash-holdings/{id} [delete]
func (s *Server) deleteCashHolding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid cash holding ID",
		})
		return
	}

	// Delete the cash holding record
	query := `DELETE FROM cash_holdings WHERE id = $1`
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete cash holding",
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
			"error": "Cash holding not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Cash holding deleted successfully",
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
		SELECT ch.id, ch.institution_name, ch.crypto_symbol, 
		       ch.balance_tokens, ch.purchase_price_usd, ch.purchase_date,
		       ch.wallet_address, ch.notes, ch.staking_annual_percentage, ch.created_at, ch.updated_at,
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
			ID                      int      `json:"id"`
			InstitutionName         string   `json:"institution_name"`
			CryptoSymbol            string   `json:"crypto_symbol"`
			BalanceTokens           float64  `json:"balance_tokens"`
			PurchasePriceUSD        *float64 `json:"purchase_price_usd"`
			PurchaseDate            *string  `json:"purchase_date"`
			WalletAddress           *string  `json:"wallet_address"`
			Notes                   *string  `json:"notes"`
			StakingAnnualPercentage *float64 `json:"staking_annual_percentage"`
			CreatedAt               string   `json:"created_at"`
			UpdatedAt               string   `json:"updated_at"`
			PriceUSD                *float64 `json:"current_price_usd"`
			PriceBTC                *float64 `json:"current_price_btc"`
			PriceChange24h          *float64 `json:"price_change_24h"`
			PriceLastUpdated        *string  `json:"price_last_updated"`
		}

		err := rows.Scan(
			&holding.ID, &holding.InstitutionName, &holding.CryptoSymbol,
			&holding.BalanceTokens, &holding.PurchasePriceUSD, &holding.PurchaseDate,
			&holding.WalletAddress, &holding.Notes, &holding.StakingAnnualPercentage, &holding.CreatedAt, &holding.UpdatedAt,
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
			"id":                        holding.ID,
			"institution_name":          holding.InstitutionName,
			"crypto_symbol":             holding.CryptoSymbol,
			"balance_tokens":            holding.BalanceTokens,
			"purchase_price_usd":        holding.PurchasePriceUSD,
			"purchase_date":             holding.PurchaseDate,
			"wallet_address":            holding.WalletAddress,
			"notes":                     holding.Notes,
			"staking_annual_percentage": holding.StakingAnnualPercentage,
			"created_at":                holding.CreatedAt,
			"updated_at":                holding.UpdatedAt,
			"current_price_usd":         holding.PriceUSD,
			"current_price_btc":         holding.PriceBTC,
			"current_value_usd":         currentValueUSD,
			"price_change_24h":          holding.PriceChange24h,
			"price_last_updated":        holding.PriceLastUpdated,
		}
		holdings = append(holdings, holdingMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"crypto_holdings": holdings,
	})
}

// @Summary Create new crypto holding
// @Description Create a new cryptocurrency holding using the crypto holdings plugin
// @Tags crypto-holdings
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Crypto holding details"
// @Success 201 {object} map[string]interface{} "Crypto holding created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto-holdings [post]
func (s *Server) createCryptoHolding(c *gin.Context) {
	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Get the crypto holdings plugin
	plugin, err := s.pluginManager.GetPlugin("crypto_holdings")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Crypto holdings plugin not found",
		})
		return
	}

	manualPlugin, ok := plugin.(interface {
		ProcessManualEntry(data map[string]interface{}) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Process the manual entry
	err = manualPlugin.ProcessManualEntry(requestData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to create crypto holding: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Crypto holding created successfully",
	})
}

// @Summary Update crypto holding
// @Description Update an existing cryptocurrency holding using the crypto holdings plugin
// @Tags crypto-holdings
// @Accept json
// @Produce json
// @Param id path int true "Crypto holding ID"
// @Param request body map[string]interface{} true "Updated crypto holding details"
// @Success 200 {object} map[string]interface{} "Crypto holding updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid data"
// @Failure 404 {object} map[string]interface{} "Crypto holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto-holdings/{id} [put]
func (s *Server) updateCryptoHolding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid crypto holding ID",
		})
		return
	}

	var requestData map[string]interface{}
	if err := c.ShouldBindJSON(&requestData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Get the crypto holdings plugin
	plugin, err := s.pluginManager.GetPlugin("crypto_holdings")
	if err != nil || plugin == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Crypto holdings plugin not found",
		})
		return
	}

	manualPlugin, ok := plugin.(interface {
		UpdateManualEntry(id int, data map[string]interface{}) error
	})
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin does not support manual entry",
		})
		return
	}

	// Update the manual entry
	err = manualPlugin.UpdateManualEntry(id, requestData)
	if err != nil {
		if strings.Contains(err.Error(), "no crypto holding found") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Crypto holding not found",
			})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Failed to update crypto holding: %v", err),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Crypto holding updated successfully",
	})
}

// @Summary Delete crypto holding
// @Description Delete an existing cryptocurrency holding
// @Tags crypto-holdings
// @Accept json
// @Produce json
// @Param id path int true "Crypto holding ID"
// @Success 200 {object} map[string]interface{} "Crypto holding deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid ID"
// @Failure 404 {object} map[string]interface{} "Crypto holding not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /crypto-holdings/{id} [delete]
func (s *Server) deleteCryptoHolding(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid crypto holding ID",
		})
		return
	}

	// Delete the crypto holding record
	query := `DELETE FROM crypto_holdings WHERE id = $1`
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete crypto holding",
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
			"error": "Crypto holding not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Crypto holding deleted successfully",
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

// @Summary Get plugin schema for manual entry with category
// @Description Retrieve the manual entry schema for a specific plugin and category to understand required fields including custom fields
// @Tags plugins
// @Accept json
// @Produce json
// @Param name path string true "Plugin Name"
// @Param category_id path int true "Category ID"
// @Success 200 {object} map[string]interface{} "Plugin manual entry schema with custom fields"
// @Failure 400 {object} map[string]interface{} "Plugin does not support manual entry or invalid category"
// @Failure 404 {object} map[string]interface{} "Plugin not found"
// @Router /plugins/{name}/schema/{category_id} [get]
func (s *Server) getPluginSchemaForCategory(c *gin.Context) {
	pluginName := c.Param("name")
	categoryIDStr := c.Param("category_id")

	// Parse category ID
	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category ID",
		})
		return
	}

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

	// Check if this is the other_assets plugin and supports category-specific schemas
	if pluginName == "other_assets" {
		// Type assert to access the GetManualEntrySchemaForCategory method
		if otherAssetsPlugin, ok := plugin.(*plugins.OtherAssetsPlugin); ok {
			schema, err := otherAssetsPlugin.GetManualEntrySchemaForCategory(categoryID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": fmt.Sprintf("Failed to get category schema: %v", err),
				})
				return
			}
			c.JSON(http.StatusOK, schema)
			return
		}
	}

	// Fallback to regular schema for other plugins
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
// @Param type query string false "Filter by entry type (stock_holding, morgan_stanley, real_estate, etc.)"
// @Success 200 {object} map[string]interface{} "List of manual entries with metadata"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /manual-entries [get]
func (s *Server) getManualEntries(c *gin.Context) {
	entryType := c.Query("type") // Optional filter by entry type

	// Build unified query to get manual entries from all relevant tables
	query := `
		SELECT 'stock_holding' as entry_type, 
		       sh.id, sh.created_at, sh.created_at as updated_at,
		       json_build_object(
		           'symbol', sh.symbol,
		           'company_name', sh.company_name,
		           'shares_owned', sh.shares_owned,
		           'cost_basis', sh.cost_basis,
		           'current_price', sh.current_price,
		           'institution_name', sh.institution_name,
		           'data_source', sh.data_source
		       ) as data_json,
		       sh.institution_name as account_name, sh.institution_name as institution
		FROM stock_holdings sh
		WHERE sh.shares_owned IS NOT NULL
		
		UNION ALL
		
		SELECT 'morgan_stanley' as entry_type,
		       eg.id, eg.created_at, eg.created_at as updated_at,
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
		       'Morgan Stanley' as account_name, 'Morgan Stanley' as institution
		FROM equity_grants eg
		WHERE eg.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'real_estate' as entry_type,
		       re.id, re.created_at, re.created_at as updated_at,
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
		       re.property_name as account_name, 'Real Estate' as institution
		FROM real_estate_properties re
		WHERE re.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'cash_holdings' as entry_type,
		       ch.id, ch.created_at, ch.updated_at,
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
		       ch.account_name, ch.institution_name as institution
		FROM cash_holdings ch
		WHERE ch.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'crypto_holdings' as entry_type,
		       cry.id, cry.created_at, cry.updated_at,
		       json_build_object(
		           'institution_name', cry.institution_name,
		           'crypto_symbol', cry.crypto_symbol,
		           'balance_tokens', cry.balance_tokens,
		           'purchase_price_usd', cry.purchase_price_usd,
		           'purchase_date', cry.purchase_date,
		           'wallet_address', cry.wallet_address,
		           'notes', cry.notes
		       ) as data_json,
		       cry.institution_name as account_name, cry.institution_name as institution
		FROM crypto_holdings cry
		WHERE cry.created_at IS NOT NULL
		
		UNION ALL
		
		SELECT 'other_assets' as entry_type,
		       ma.id, ma.created_at, ma.last_updated as updated_at,
		       json_build_object(
		           'asset_category_id', ma.asset_category_id,
		           'asset_name', ma.asset_name,
		           'current_value', ma.current_value,
		           'purchase_price', ma.purchase_price,
		           'amount_owed', ma.amount_owed,
		           'purchase_date', ma.purchase_date,
		           'description', ma.description,
		           'custom_fields', ma.custom_fields,
		           'valuation_method', ma.valuation_method,
		           'last_valuation_date', ma.last_valuation_date,
		           'notes', ma.notes,
		           'category_name', ac.name,
		           'category_description', ac.description,
		           'category_icon', ac.icon,
		           'category_color', ac.color
		       ) as data_json,
		       ma.asset_name as account_name, 'Other Assets' as institution
		FROM miscellaneous_assets ma
		LEFT JOIN asset_categories ac ON ma.asset_category_id = ac.id
		WHERE ma.created_at IS NOT NULL
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

	// Debug: Check what's actually in the individual tables
	var stockCount, equityCount, realEstateCount, cashCount, cryptoCount int
	s.db.QueryRow("SELECT COUNT(*) FROM stock_holdings").Scan(&stockCount)
	s.db.QueryRow("SELECT COUNT(*) FROM equity_grants").Scan(&equityCount)
	s.db.QueryRow("SELECT COUNT(*) FROM real_estate_properties").Scan(&realEstateCount)
	s.db.QueryRow("SELECT COUNT(*) FROM cash_holdings").Scan(&cashCount)
	s.db.QueryRow("SELECT COUNT(*) FROM crypto_holdings").Scan(&cryptoCount)
	fmt.Printf("DEBUG: Table counts - stock: %d, equity: %d, real_estate: %d, cash: %d, crypto: %d\n",
		stockCount, equityCount, realEstateCount, cashCount, cryptoCount)

	// Debug code removed - accounts table no longer exists in new architecture

	rows, err := s.db.Query(query, args...)
	if err != nil {
		fmt.Printf("Query Error: %v\n", err)
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
			CreatedAt   string  `json:"created_at"`
			UpdatedAt   string  `json:"updated_at"`
			DataJSON    string  `json:"data_json"`
			AccountName *string `json:"account_name"`
			Institution *string `json:"institution"`
		}

		err := rows.Scan(
			&entry.EntryType, &entry.ID, &entry.CreatedAt, &entry.UpdatedAt,
			&entry.DataJSON, &entry.AccountName, &entry.Institution,
		)
		if err != nil {
			fmt.Printf("Scan Error: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to scan manual entry",
			})
			return
		}

		fmt.Printf("DEBUG: Found entry - Type: %s, ID: %d, AccountName: %v\n",
			entry.EntryType, entry.ID, entry.AccountName)

		entryMap := map[string]interface{}{
			"id":           entry.ID,
			"entry_type":   entry.EntryType,
			"data_json":    entry.DataJSON,
			"created_at":   entry.CreatedAt,
			"updated_at":   entry.UpdatedAt,
			"account_name": entry.AccountName,
			"institution":  entry.Institution,
		}
		entries = append(entries, entryMap)
	}

	fmt.Printf("DEBUG: Total entries found: %d\n", len(entries))

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
// @Param type query string true "Entry type (stock_holding, morgan_stanley, real_estate, cash_holdings, crypto_holdings)"
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
	case "stock_holding":
		query = "DELETE FROM stock_holdings WHERE id = $1 AND data_source = 'stock_holding'"
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

	// Determine the actual provider name based on results
	actualProviderName := s.determineActualProviderName(results, priceService.GetProviderName())

	summary := services.PriceRefreshSummary{
		TotalSymbols:   len(symbols),
		UpdatedSymbols: updatedCount,
		FailedSymbols:  failedCount,
		Results:        results,
		ProviderName:   actualProviderName,
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

	// Get old price and cache info for comparison and analysis
	var oldPrice float64
	var lastCacheUpdate time.Time
	var stockHoldingsPrice sql.NullFloat64
	var stockPricesTimestamp sql.NullTime

	priceQuery := `
		SELECT COALESCE(h.current_price, 0), h.current_price, sp.timestamp
		FROM stock_holdings h
		LEFT JOIN (
			SELECT symbol, timestamp 
			FROM stock_prices 
			WHERE symbol = $1 
			ORDER BY timestamp DESC 
			LIMIT 1
		) sp ON sp.symbol = h.symbol
		WHERE h.symbol = $1 
		LIMIT 1
	`
	err := s.db.QueryRow(priceQuery, symbol).Scan(&oldPrice, &stockHoldingsPrice, &stockPricesTimestamp)
	if err != nil && err != sql.ErrNoRows {
		fmt.Printf("ERROR: Failed to get old price for %s: %v\n", symbol, err)
	}

	// Determine cache source and age
	if stockPricesTimestamp.Valid {
		lastCacheUpdate = stockPricesTimestamp.Time
		fmt.Printf("DEBUG: Old price %.2f for %s from stock_prices table (timestamp: %v)\n", oldPrice, symbol, lastCacheUpdate)
	} else if stockHoldingsPrice.Valid {
		fmt.Printf("DEBUG: Old price %.2f for %s from stock_holdings.current_price (no stock_prices entry)\n", oldPrice, symbol)
		// For stock holdings price, we don't have a reliable timestamp, so use a very old date to force refresh
		lastCacheUpdate = time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	} else {
		fmt.Printf("DEBUG: No old price found for %s in any cache location\n", symbol)
		oldPrice = 0
		lastCacheUpdate = time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	}

	// Calculate cache age if we have cache data
	if !lastCacheUpdate.IsZero() && lastCacheUpdate.Year() > 1970 {
		cacheAge := time.Since(lastCacheUpdate)
		if cacheAge < time.Minute {
			result.CacheAge = fmt.Sprintf("%.0fs", cacheAge.Seconds())
		} else if cacheAge < time.Hour {
			result.CacheAge = fmt.Sprintf("%.0fm", cacheAge.Minutes())
		} else {
			result.CacheAge = fmt.Sprintf("%.1fh", cacheAge.Hours())
		}
	}

	result.OldPrice = oldPrice

	// Get current price from service
	newPrice, err := priceService.GetCurrentPriceWithForce(symbol, forceRefresh)
	if err != nil {
		result.Error = err.Error()

		// Categorize the error type for better handling
		errorStr := strings.ToLower(err.Error())
		if strings.Contains(errorStr, "rate limit") {
			result.ErrorType = "rate_limited"
		} else if strings.Contains(errorStr, "no cached price") || strings.Contains(errorStr, "cache") {
			result.ErrorType = "cache_error"
			result.Source = "cache"
		} else if strings.Contains(errorStr, "api") || strings.Contains(errorStr, "fetch") {
			result.ErrorType = "api_error"
		} else if strings.Contains(errorStr, "symbol") || strings.Contains(errorStr, "not found") {
			result.ErrorType = "invalid_symbol"
		} else {
			result.ErrorType = "unknown"
		}
		return result
	}

	result.NewPrice = newPrice

	// Calculate price changes
	if oldPrice > 0 {
		result.PriceChange = newPrice - oldPrice
		result.PriceChangePct = (result.PriceChange / oldPrice) * 100
	}

	// Determine source - if we got a new price and it's different from cache, it's from API
	if forceRefresh || newPrice != oldPrice {
		result.Source = "api"
	} else {
		result.Source = "cache"
	}

	// Update stock_holdings with transaction for consistency
	fmt.Printf("INFO: Starting database transaction to update prices for %s (new price: %.2f)\n", symbol, newPrice)
	tx, err := s.db.Begin()
	if err != nil {
		result.Error = fmt.Sprintf("Failed to start transaction: %v", err)
		result.ErrorType = "database_error"
		fmt.Printf("ERROR: Failed to start transaction for %s: %v\n", symbol, err)
		return result
	}
	defer tx.Rollback()

	stockUpdate := `
		UPDATE stock_holdings 
		SET current_price = $1, last_updated = $2 
		WHERE symbol = $3
	`
	fmt.Printf("INFO: Updating stock_holdings for %s with price %.2f\n", symbol, newPrice)
	stockResult, err := tx.Exec(stockUpdate, newPrice, time.Now(), symbol)

	// Update equity_grants
	equityUpdate := `
		UPDATE equity_grants 
		SET current_price = $1, last_updated = $2 
		WHERE company_symbol = $3
	`
	fmt.Printf("INFO: Updating equity_grants for %s with price %.2f\n", symbol, newPrice)
	equityResult, err2 := tx.Exec(equityUpdate, newPrice, time.Now(), symbol)

	// Check if any rows were updated
	stockRows, stockErr := stockResult.RowsAffected()
	equityRows, equityErr := equityResult.RowsAffected()

	fmt.Printf("INFO: Database update results for %s - stock_holdings: %d rows, equity_grants: %d rows\n", symbol, stockRows, equityRows)

	// Handle database errors comprehensively
	if err != nil && err2 != nil {
		result.Error = fmt.Sprintf("Update failed: stock_holdings: %v, equity_grants: %v", err, err2)
		result.ErrorType = "database_error"
		fmt.Printf("ERROR: Both updates failed for %s - stock: %v, equity: %v\n", symbol, err, err2)
	} else if stockErr != nil || equityErr != nil {
		result.Error = fmt.Sprintf("Failed to check affected rows: %v, %v", stockErr, equityErr)
		result.ErrorType = "database_error"
		fmt.Printf("ERROR: Failed to check affected rows for %s - stock: %v, equity: %v\n", symbol, stockErr, equityErr)
	} else if stockRows > 0 || equityRows > 0 {
		// Commit the transaction only if updates were successful
		if commitErr := tx.Commit(); commitErr != nil {
			result.Error = fmt.Sprintf("Failed to commit transaction: %v", commitErr)
			result.ErrorType = "database_error"
			fmt.Printf("ERROR: Failed to commit transaction for %s: %v\n", symbol, commitErr)
		} else {
			result.Updated = true
			fmt.Printf("SUCCESS: Price update committed for %s - stock_holdings: %d rows, equity_grants: %d rows\n", symbol, stockRows, equityRows)
		}
	} else {
		result.Error = "No records found to update for this symbol"
		result.ErrorType = "invalid_symbol"
		fmt.Printf("WARNING: No records found to update for symbol %s - may not exist in stock_holdings or equity_grants\n", symbol)
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
	summary, err := s.cryptoService.RefreshAllCryptoPrices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to refresh crypto prices: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, summary)
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
		"message":          fmt.Sprintf("Price refreshed for %s", symbol),
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
			"timestamp": lastUpdated.Format(time.RFC3339),
			"price_usd": priceUSD,
			"price_btc": priceBTC,
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
			"error":           "Property valuation feature is currently disabled",
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
			"error":           "Property valuation feature is currently disabled",
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
		"message":   "Property valuation refreshed successfully",
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
					"name":        "Manual Entry",
					"available":   true,
					"description": "Manual property value entry (external APIs disabled)",
				},
			},
			"active_provider": "Manual Entry",
			"feature_enabled": false,
			"message":         "Property valuation feature is disabled",
		})
		return
	}

	providers := []gin.H{
		{
			"name":        "Manual Entry",
			"available":   true,
			"description": "Manual property value entry",
		},
	}

	if s.propertyValuationService.IsAttomDataAvailable() {
		providers = append(providers, gin.H{
			"name":        "ATTOM Data API",
			"available":   true,
			"description": "Professional property data and valuation from ATTOM Data",
		})
	} else {
		providers = append(providers, gin.H{
			"name":        "ATTOM Data API",
			"available":   false,
			"description": "Professional property data and valuation from ATTOM Data (API key required or feature disabled)",
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"providers":       providers,
		"active_provider": s.propertyValuationService.GetProviderName(),
		"feature_enabled": true,
	})
}

// Other Assets handlers

// @Summary Get all other assets
// @Description Retrieve all miscellaneous assets with category information
// @Tags other-assets
// @Accept json
// @Produce json
// @Param category query int false "Filter by asset category ID"
// @Success 200 {object} map[string]interface{} "List of other assets"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /other-assets [get]
func (s *Server) getOtherAssets(c *gin.Context) {
	categoryFilter := c.Query("category")

	query := `
		SELECT ma.id, ma.asset_name, ma.current_value, ma.purchase_price, 
		       ma.amount_owed, ma.purchase_date, ma.description, ma.custom_fields,
		       ma.valuation_method, ma.last_valuation_date, ma.api_provider,
		       ma.notes, ma.created_at, ma.last_updated,
		       ac.name as category_name, ac.description as category_description,
		       ac.icon as category_icon, ac.color as category_color,
		       ma.asset_category_id
		FROM miscellaneous_assets ma
		LEFT JOIN asset_categories ac ON ma.asset_category_id = ac.id
	`

	args := []interface{}{}
	if categoryFilter != "" {
		query += " WHERE ma.asset_category_id = $1"
		categoryID, err := strconv.Atoi(categoryFilter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid category ID",
			})
			return
		}
		args = append(args, categoryID)
	}

	query += " ORDER BY ma.last_updated DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch other assets",
		})
		return
	}
	defer rows.Close()

	var assets []map[string]interface{}
	for rows.Next() {
		var asset struct {
			ID                  int             `json:"id"`
			AssetName           string          `json:"asset_name"`
			CurrentValue        float64         `json:"current_value"`
			PurchasePrice       sql.NullFloat64 `json:"purchase_price"`
			AmountOwed          sql.NullFloat64 `json:"amount_owed"`
			PurchaseDate        sql.NullTime    `json:"purchase_date"`
			Description         sql.NullString  `json:"description"`
			CustomFields        sql.NullString  `json:"custom_fields"`
			ValuationMethod     string          `json:"valuation_method"`
			LastValuationDate   sql.NullTime    `json:"last_valuation_date"`
			APIProvider         sql.NullString  `json:"api_provider"`
			Notes               sql.NullString  `json:"notes"`
			CreatedAt           time.Time       `json:"created_at"`
			LastUpdated         time.Time       `json:"last_updated"`
			CategoryName        sql.NullString  `json:"category_name"`
			CategoryDescription sql.NullString  `json:"category_description"`
			CategoryIcon        sql.NullString  `json:"category_icon"`
			CategoryColor       sql.NullString  `json:"category_color"`
			AssetCategoryID     sql.NullInt64   `json:"asset_category_id"`
		}

		err := rows.Scan(
			&asset.ID, &asset.AssetName, &asset.CurrentValue, &asset.PurchasePrice,
			&asset.AmountOwed, &asset.PurchaseDate, &asset.Description, &asset.CustomFields,
			&asset.ValuationMethod, &asset.LastValuationDate, &asset.APIProvider,
			&asset.Notes, &asset.CreatedAt, &asset.LastUpdated,
			&asset.CategoryName, &asset.CategoryDescription, &asset.CategoryIcon,
			&asset.CategoryColor, &asset.AssetCategoryID,
		)
		if err != nil {
			continue
		}

		// Calculate equity (value - amount owed)
		var equity float64
		if asset.AmountOwed.Valid {
			equity = asset.CurrentValue - asset.AmountOwed.Float64
		} else {
			equity = asset.CurrentValue
		}

		// Parse custom fields JSON
		var customFields map[string]interface{}
		if asset.CustomFields.Valid && asset.CustomFields.String != "" {
			json.Unmarshal([]byte(asset.CustomFields.String), &customFields)
		}

		assetMap := map[string]interface{}{
			"id":                asset.ID,
			"asset_name":        asset.AssetName,
			"current_value":     asset.CurrentValue,
			"equity":            equity,
			"valuation_method":  asset.ValuationMethod,
			"created_at":        asset.CreatedAt,
			"last_updated":      asset.LastUpdated,
			"asset_category_id": asset.AssetCategoryID.Int64,
		}

		// Add optional fields
		if asset.PurchasePrice.Valid {
			assetMap["purchase_price"] = asset.PurchasePrice.Float64
		}
		if asset.AmountOwed.Valid {
			assetMap["amount_owed"] = asset.AmountOwed.Float64
		}
		if asset.PurchaseDate.Valid {
			assetMap["purchase_date"] = asset.PurchaseDate.Time.Format("2006-01-02")
		}
		if asset.Description.Valid {
			assetMap["description"] = asset.Description.String
		}
		if asset.Notes.Valid {
			assetMap["notes"] = asset.Notes.String
		}
		if asset.LastValuationDate.Valid {
			assetMap["last_valuation_date"] = asset.LastValuationDate.Time
		}
		if asset.APIProvider.Valid {
			assetMap["api_provider"] = asset.APIProvider.String
		}
		if customFields != nil {
			assetMap["custom_fields"] = customFields
		}

		// Add category information
		if asset.CategoryName.Valid {
			assetMap["category"] = map[string]interface{}{
				"name":        asset.CategoryName.String,
				"description": asset.CategoryDescription.String,
				"icon":        asset.CategoryIcon.String,
				"color":       asset.CategoryColor.String,
			}
		}

		assets = append(assets, assetMap)
	}

	// Calculate total value and equity
	var totalValue, totalEquity float64
	for _, asset := range assets {
		totalValue += asset["current_value"].(float64)
		totalEquity += asset["equity"].(float64)
	}

	c.JSON(http.StatusOK, gin.H{
		"other_assets": assets,
		"summary": gin.H{
			"total_count":  len(assets),
			"total_value":  totalValue,
			"total_equity": totalEquity,
		},
	})
}

// @Summary Create new other asset
// @Description Create a new miscellaneous asset entry
// @Tags other-assets
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Other asset data"
// @Success 201 {object} map[string]interface{} "Other asset created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or validation error"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /other-assets [post]
func (s *Server) createOtherAsset(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Use the other_assets plugin to process the entry
	err := s.pluginManager.ProcessManualEntry("other_assets", data)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Other asset created successfully",
	})
}

// @Summary Update other asset
// @Description Update an existing miscellaneous asset entry
// @Tags other-assets
// @Accept json
// @Produce json
// @Param id path int true "Asset ID"
// @Param request body map[string]interface{} true "Updated asset data"
// @Success 200 {object} map[string]interface{} "Other asset updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or validation error"
// @Failure 404 {object} map[string]interface{} "Asset not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /other-assets/{id} [put]
func (s *Server) updateOtherAsset(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset ID",
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

	// Get the other_assets plugin
	plugin, err := s.pluginManager.GetPlugin("other_assets")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Plugin not found",
		})
		return
	}

	// Update the entry
	err = plugin.UpdateManualEntry(id, data)
	if err != nil {
		if err.Error() == "other asset not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Asset not found",
			})
		} else {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Other asset updated successfully",
	})
}

// @Summary Delete other asset
// @Description Delete a miscellaneous asset entry
// @Tags other-assets
// @Accept json
// @Produce json
// @Param id path int true "Asset ID"
// @Success 200 {object} map[string]interface{} "Other asset deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Asset not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /other-assets/{id} [delete]
func (s *Server) deleteOtherAsset(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid asset ID",
		})
		return
	}

	query := "DELETE FROM miscellaneous_assets WHERE id = $1"
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete asset",
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
			"error": "Asset not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Other asset deleted successfully",
	})
}

// Asset Categories handlers

// @Summary Get all asset categories
// @Description Retrieve all asset categories with their custom schemas
// @Tags asset-categories
// @Accept json
// @Produce json
// @Param active query boolean false "Filter by active status"
// @Success 200 {object} map[string]interface{} "List of asset categories"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /asset-categories [get]
func (s *Server) getAssetCategories(c *gin.Context) {
	activeFilter := c.Query("active")

	query := `
		SELECT id, name, description, icon, color, custom_schema, 
		       valuation_api_config, is_active, sort_order, 
		       created_at, updated_at
		FROM asset_categories
	`

	args := []interface{}{}
	if activeFilter == "true" {
		query += " WHERE is_active = true"
	}

	query += " ORDER BY sort_order, name"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch asset categories",
		})
		return
	}
	defer rows.Close()

	var categories []map[string]interface{}
	for rows.Next() {
		var category struct {
			ID                 int            `json:"id"`
			Name               string         `json:"name"`
			Description        sql.NullString `json:"description"`
			Icon               sql.NullString `json:"icon"`
			Color              sql.NullString `json:"color"`
			CustomSchema       sql.NullString `json:"custom_schema"`
			ValuationAPIConfig sql.NullString `json:"valuation_api_config"`
			IsActive           bool           `json:"is_active"`
			SortOrder          int            `json:"sort_order"`
			CreatedAt          time.Time      `json:"created_at"`
			UpdatedAt          time.Time      `json:"updated_at"`
		}

		err := rows.Scan(
			&category.ID, &category.Name, &category.Description, &category.Icon,
			&category.Color, &category.CustomSchema, &category.ValuationAPIConfig,
			&category.IsActive, &category.SortOrder, &category.CreatedAt, &category.UpdatedAt,
		)
		if err != nil {
			continue
		}

		categoryMap := map[string]interface{}{
			"id":         category.ID,
			"name":       category.Name,
			"is_active":  category.IsActive,
			"sort_order": category.SortOrder,
			"created_at": category.CreatedAt,
			"updated_at": category.UpdatedAt,
		}

		// Add optional fields
		if category.Description.Valid {
			categoryMap["description"] = category.Description.String
		}
		if category.Icon.Valid {
			categoryMap["icon"] = category.Icon.String
		}
		if category.Color.Valid {
			categoryMap["color"] = category.Color.String
		}

		// Parse custom schema
		if category.CustomSchema.Valid && category.CustomSchema.String != "" {
			var schema map[string]interface{}
			if err := json.Unmarshal([]byte(category.CustomSchema.String), &schema); err == nil {
				categoryMap["custom_schema"] = schema
			}
		}

		// Parse valuation API config
		if category.ValuationAPIConfig.Valid && category.ValuationAPIConfig.String != "" {
			var config map[string]interface{}
			if err := json.Unmarshal([]byte(category.ValuationAPIConfig.String), &config); err == nil {
				categoryMap["valuation_api_config"] = config
			}
		}

		categories = append(categories, categoryMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"asset_categories": categories,
		"total_count":      len(categories),
	})
}

// @Summary Create new asset category
// @Description Create a new asset category with custom schema
// @Tags asset-categories
// @Accept json
// @Produce json
// @Param request body map[string]interface{} true "Asset category data"
// @Success 201 {object} map[string]interface{} "Asset category created successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or validation error"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /asset-categories [post]
func (s *Server) createAssetCategory(c *gin.Context) {
	var data map[string]interface{}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid JSON data",
		})
		return
	}

	// Validate required fields
	name, ok := data["name"].(string)
	if !ok || strings.TrimSpace(name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Name is required",
		})
		return
	}

	// Prepare optional fields
	var description, icon, color sql.NullString
	var customSchema, valuationAPIConfig sql.NullString
	var isActive = true
	var sortOrder = 0

	if desc, ok := data["description"].(string); ok {
		description.String = desc
		description.Valid = true
	}
	if ic, ok := data["icon"].(string); ok {
		icon.String = ic
		icon.Valid = true
	}
	if col, ok := data["color"].(string); ok {
		color.String = col
		color.Valid = true
	}
	if active, ok := data["is_active"].(bool); ok {
		isActive = active
	}
	if order, ok := data["sort_order"].(float64); ok {
		sortOrder = int(order)
	}

	// Handle custom schema
	if schema, ok := data["custom_schema"]; ok {
		if schemaJSON, err := json.Marshal(schema); err == nil {
			customSchema.String = string(schemaJSON)
			customSchema.Valid = true
		}
	}

	// Handle valuation API config
	if config, ok := data["valuation_api_config"]; ok {
		if configJSON, err := json.Marshal(config); err == nil {
			valuationAPIConfig.String = string(configJSON)
			valuationAPIConfig.Valid = true
		}
	}

	query := `
		INSERT INTO asset_categories (name, description, icon, color, custom_schema, 
		                            valuation_api_config, is_active, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	var categoryID int
	err := s.db.QueryRow(query, name, description, icon, color, customSchema,
		valuationAPIConfig, isActive, sortOrder).Scan(&categoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create asset category",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":     "Asset category created successfully",
		"category_id": categoryID,
	})
}

// @Summary Update asset category
// @Description Update an existing asset category
// @Tags asset-categories
// @Accept json
// @Produce json
// @Param id path int true "Category ID"
// @Param request body map[string]interface{} true "Updated category data"
// @Success 200 {object} map[string]interface{} "Asset category updated successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or validation error"
// @Failure 404 {object} map[string]interface{} "Category not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /asset-categories/{id} [put]
func (s *Server) updateAssetCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category ID",
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

	// Build dynamic update query
	var setParts []string
	var args []interface{}
	argIndex := 1

	if name, ok := data["name"].(string); ok && strings.TrimSpace(name) != "" {
		setParts = append(setParts, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, strings.TrimSpace(name))
		argIndex++
	}

	if desc, ok := data["description"].(string); ok {
		setParts = append(setParts, fmt.Sprintf("description = $%d", argIndex))
		args = append(args, desc)
		argIndex++
	}

	if icon, ok := data["icon"].(string); ok {
		setParts = append(setParts, fmt.Sprintf("icon = $%d", argIndex))
		args = append(args, icon)
		argIndex++
	}

	if color, ok := data["color"].(string); ok {
		setParts = append(setParts, fmt.Sprintf("color = $%d", argIndex))
		args = append(args, color)
		argIndex++
	}

	if active, ok := data["is_active"].(bool); ok {
		setParts = append(setParts, fmt.Sprintf("is_active = $%d", argIndex))
		args = append(args, active)
		argIndex++
	}

	if order, ok := data["sort_order"].(float64); ok {
		setParts = append(setParts, fmt.Sprintf("sort_order = $%d", argIndex))
		args = append(args, int(order))
		argIndex++
	}

	if schema, ok := data["custom_schema"]; ok {
		if schemaJSON, err := json.Marshal(schema); err == nil {
			setParts = append(setParts, fmt.Sprintf("custom_schema = $%d", argIndex))
			args = append(args, string(schemaJSON))
			argIndex++
		}
	}

	if config, ok := data["valuation_api_config"]; ok {
		if configJSON, err := json.Marshal(config); err == nil {
			setParts = append(setParts, fmt.Sprintf("valuation_api_config = $%d", argIndex))
			args = append(args, string(configJSON))
			argIndex++
		}
	}

	if len(setParts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No valid fields to update",
		})
		return
	}

	// Add updated_at
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, time.Now())
	argIndex++

	// Add WHERE condition
	args = append(args, id)

	query := fmt.Sprintf("UPDATE asset_categories SET %s WHERE id = $%d",
		strings.Join(setParts, ", "), argIndex)

	result, err := s.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update asset category",
		})
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check update result",
		})
		return
	}

	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Asset category not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Asset category updated successfully",
	})
}

// @Summary Delete asset category
// @Description Delete an asset category (only if no assets use it)
// @Tags asset-categories
// @Accept json
// @Produce json
// @Param id path int true "Category ID"
// @Success 200 {object} map[string]interface{} "Asset category deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or category in use"
// @Failure 404 {object} map[string]interface{} "Category not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /asset-categories/{id} [delete]
func (s *Server) deleteAssetCategory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category ID",
		})
		return
	}

	// Check if category is in use
	var count int
	countQuery := "SELECT COUNT(*) FROM miscellaneous_assets WHERE asset_category_id = $1"
	err = s.db.QueryRow(countQuery, id).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check category usage",
		})
		return
	}

	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Cannot delete category: %d assets are using this category", count),
		})
		return
	}

	// Delete category
	query := "DELETE FROM asset_categories WHERE id = $1"
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete asset category",
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
			"error": "Asset category not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Asset category deleted successfully",
	})
}

// @Summary Get asset category schema
// @Description Get the custom field schema for a specific asset category
// @Tags asset-categories
// @Accept json
// @Produce json
// @Param id path int true "Category ID"
// @Success 200 {object} map[string]interface{} "Asset category schema"
// @Failure 404 {object} map[string]interface{} "Category not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /asset-categories/{id}/schema [get]
func (s *Server) getAssetCategorySchema(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid category ID",
		})
		return
	}

	var name, description sql.NullString
	var customSchema sql.NullString

	query := "SELECT name, description, custom_schema FROM asset_categories WHERE id = $1"
	err = s.db.QueryRow(query, id).Scan(&name, &description, &customSchema)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Asset category not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to fetch category schema",
			})
		}
		return
	}

	result := map[string]interface{}{
		"category_id": id,
		"name":        name.String,
	}

	if description.Valid {
		result["description"] = description.String
	}

	if customSchema.Valid && customSchema.String != "" {
		var schema map[string]interface{}
		if err := json.Unmarshal([]byte(customSchema.String), &schema); err == nil {
			result["schema"] = schema
		}
	}

	c.JSON(http.StatusOK, result)
}

// determineActualProviderName analyzes the refresh results to determine what provider was actually used
func (s *Server) determineActualProviderName(results []services.PriceUpdateResult, defaultProviderName string) string {
	if len(results) == 0 {
		return defaultProviderName
	}

	apiCount := 0
	cacheCount := 0

	// Count API vs cache sources
	for _, result := range results {
		if result.Updated {
			if result.Source == "api" {
				apiCount++
			} else if result.Source == "cache" {
				cacheCount++
			}
		}
	}

	// If all data came from cache, indicate that
	if apiCount == 0 && cacheCount > 0 {
		return "Cache"
	}

	// If all data came from API, use the configured provider name
	if apiCount > 0 && cacheCount == 0 {
		return defaultProviderName
	}

	// If mixed sources, indicate that
	if apiCount > 0 && cacheCount > 0 {
		return fmt.Sprintf("%s + Cache", defaultProviderName)
	}

	// Default fallback
	return defaultProviderName
}

// Document Processing handlers (LLM integration)

// @Summary Upload financial document
// @Description Upload a financial document (PDF, CSV, image) for LLM processing
// @Tags documents
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Financial document file (PDF, CSV, JPG, PNG)"
// @Success 201 {object} map[string]interface{} "Document uploaded successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid file"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents/upload [post]
func (s *Server) uploadDocument(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No file provided or invalid form data",
		})
		return
	}
	defer file.Close()

	// Validate file type
	allowedTypes := []string{".pdf", ".csv", ".jpg", ".jpeg", ".png", ".xlsx", ".xls"}
	fileExt := strings.ToLower(filepath.Ext(header.Filename))
	isAllowed := false
	for _, ext := range allowedTypes {
		if fileExt == ext {
			isAllowed = true
			break
		}
	}

	if !isAllowed {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "Unsupported file type",
			"allowed_types": allowedTypes,
			"received_type": fileExt,
		})
		return
	}

	// Upload document
	job, err := s.documentProcessor.UploadDocument(c.Request.Context(), file, header)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to upload document: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Document uploaded successfully",
		"job": gin.H{
			"id":                job.ID,
			"filename":          job.Filename,
			"file_path":         job.FilePath,
			"file_type":         job.FileType,
			"file_size":         job.FileSize,
			"processing_status": job.ProcessingStatus,
			"created_at":        job.CreatedAt,
			"updated_at":        job.UpdatedAt,
		},
	})
}

// @Summary Get document processing job
// @Description Retrieve details of a document processing job
// @Tags documents
// @Accept json
// @Produce json
// @Param id path int true "Document job ID"
// @Success 200 {object} map[string]interface{} "Document job details"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Job not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents/{id} [get]
func (s *Server) getDocument(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid job ID",
		})
		return
	}

	job, err := s.documentProcessor.GetJob(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "job not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Document job not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to get document job: %v", err),
			})
		}
		return
	}

	response := map[string]interface{}{
		"id":                job.ID,
		"filename":          job.Filename,
		"file_type":         job.FileType,
		"file_size":         job.FileSize,
		"processing_status": job.ProcessingStatus,
		"created_at":        job.CreatedAt,
		"updated_at":        job.UpdatedAt,
	}


	if job.ExtractedData != nil {
		response["extracted_data"] = *job.ExtractedData
	}

	if job.ErrorMessage != nil {
		response["error_message"] = *job.ErrorMessage
	}

	c.JSON(http.StatusOK, response)
}

// ImportResult represents the result of importing extracted document data
type ImportResult struct {
	ImportedAccounts    int                    `json:"imported_accounts"`
	ImportedTransactions int                   `json:"imported_transactions"`
	ImportedHoldings    int                    `json:"imported_holdings"`
	AccountMatches      []AccountMatch         `json:"account_matches"`
	NewAccounts         []CreatedAccount       `json:"new_accounts"`
	TransactionSummary  TransactionSummary     `json:"transaction_summary"`
	HoldingSummary      HoldingSummary         `json:"holding_summary"`
	Warnings           []string               `json:"warnings,omitempty"`
}

type AccountMatch struct {
	ExtractedAccount services.ExtractedAccount `json:"extracted_account"`
	MatchedAccountID int                       `json:"matched_account_id"`
	MatchType        string                    `json:"match_type"` // "exact", "partial", "new"
}

type CreatedAccount struct {
	AccountID        int    `json:"account_id"`
	AccountName      string `json:"account_name"`
	AccountType      string `json:"account_type"`
	Institution      string `json:"institution"`
}

type TransactionSummary struct {
	TotalAmount    float64 `json:"total_amount"`
	DebitsTotal    float64 `json:"debits_total"`
	CreditsTotal   float64 `json:"credits_total"`
	DateRange      string  `json:"date_range"`
}

type HoldingSummary struct {
	TotalValue     float64 `json:"total_value"`
	UniqueSymbols  int     `json:"unique_symbols"`
}

// importExtractedData imports extracted financial data into the dashboard
func (s *Server) importExtractedData(ctx context.Context, data *services.FinancialDocumentData) (*ImportResult, error) {
	log.Printf("Importing data for %s - Accounts: %d, Transactions: %d, Holdings: %d, Crypto: %d", 
		data.Institution, len(data.Accounts), len(data.Transactions), len(data.Holdings), len(data.Crypto))
	
	result := &ImportResult{
		AccountMatches: make([]AccountMatch, 0),
		NewAccounts:    make([]CreatedAccount, 0),
		Warnings:       make([]string, 0),
	}

	// Start a database transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback() // Will be ignored if Commit() is called

	// Step 1: Import or match accounts
	accountMap := make(map[string]int) // Maps account number to account ID
	for _, account := range data.Accounts {
		log.Printf("Importing account: %s (%s) - %s", account.AccountNumber, account.AccountType, account.Name)
		accountID, isNew, err := s.importAccount(ctx, tx, &account, data.Institution)
		if err != nil {
			log.Printf("Failed to import account %s: %v", account.AccountNumber, err)
			return nil, fmt.Errorf("failed to import account %s: %w", account.AccountNumber, err)
		}
		log.Printf("Account %s imported successfully - ID: %d, New: %v", account.AccountNumber, accountID, isNew)

		accountMap[account.AccountNumber] = accountID
		
		match := AccountMatch{
			ExtractedAccount: account,
			MatchedAccountID: accountID,
		}

		if isNew {
			match.MatchType = "new"
			result.NewAccounts = append(result.NewAccounts, CreatedAccount{
				AccountID:   accountID,
				AccountName: account.Name,
				AccountType: account.AccountType,
				Institution: data.Institution,
			})
		} else {
			match.MatchType = "matched"
		}

		result.AccountMatches = append(result.AccountMatches, match)
		result.ImportedAccounts++
	}

	// Step 2: Import transactions (if any account was found)
	var totalDebits, totalCredits float64
	var minDate, maxDate string
	
	for _, transaction := range data.Transactions {
		// Note: Transaction import is currently a placeholder since we import account balances directly
		// The account balance is already updated in the cash_holdings table above
		log.Printf("Transaction found (not imported): %s, %f, %s", 
			transaction.Description, transaction.Amount, transaction.Date)

		if transaction.Type == "debit" {
			totalDebits += transaction.Amount
		} else {
			totalCredits += transaction.Amount
		}

		if minDate == "" || transaction.Date < minDate {
			minDate = transaction.Date
		}
		if maxDate == "" || transaction.Date > maxDate {
			maxDate = transaction.Date
		}

		result.ImportedTransactions++
	}

	result.TransactionSummary = TransactionSummary{
		TotalAmount:  totalCredits - totalDebits,
		DebitsTotal:  totalDebits,
		CreditsTotal: totalCredits,
		DateRange:    fmt.Sprintf("%s to %s", minDate, maxDate),
	}

	// Step 3: Import holdings
	var totalHoldingValue float64
	uniqueSymbols := make(map[string]bool)

	for _, holding := range data.Holdings {
		// Import directly to stock_holdings table
		err := s.importHolding(ctx, tx, &holding, data.Institution)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to import holding: %s", holding.Symbol))
			continue
		}

		totalHoldingValue += holding.Value
		uniqueSymbols[holding.Symbol] = true
		result.ImportedHoldings++
	}

	result.HoldingSummary = HoldingSummary{
		TotalValue:    totalHoldingValue,
		UniqueSymbols: len(uniqueSymbols),
	}

	// Step 4: Import crypto holdings
	var totalCryptoValue float64
	uniqueCryptoSymbols := make(map[string]bool)

	for _, crypto := range data.Crypto {
		err := s.importCrypto(ctx, tx, &crypto, data.Institution)
		if err != nil {
			result.Warnings = append(result.Warnings, fmt.Sprintf("Failed to import crypto: %s", crypto.Symbol))
			continue
		}

		totalCryptoValue += crypto.Value
		uniqueCryptoSymbols[crypto.Symbol] = true
		// Note: We don't have ImportedCrypto field in ImportResult struct yet, 
		// but the crypto will be imported successfully
	}

	if len(data.Crypto) > 0 {
		log.Printf("Imported %d crypto holdings with total value $%.2f", len(uniqueCryptoSymbols), totalCryptoValue)
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Data import successful for %s - Accounts: %d, Holdings: %d, Crypto: %d", 
		data.Institution, result.ImportedAccounts, result.ImportedHoldings, len(uniqueCryptoSymbols))

	return result, nil
}

// importAccount imports or matches a cash account directly into cash_holdings table and returns the cash holding ID and whether it's new
func (s *Server) importAccount(ctx context.Context, tx *sql.Tx, account *services.ExtractedAccount, institution string) (int, bool, error) {
	// Try to find existing cash holding by account number and institution
	var existingID int
	query := `SELECT id FROM cash_holdings WHERE account_number_last4 = $1 AND institution_name = $2 LIMIT 1`
	// Use last 4 digits of account number to match the schema
	last4 := account.AccountNumber
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	err := tx.QueryRowContext(ctx, query, last4, institution).Scan(&existingID)
	
	if err == nil {
		// Found existing cash holding - update balance
		updateQuery := `UPDATE cash_holdings SET current_balance = $1, currency = $2, updated_at = NOW() WHERE id = $3`
		_, updateErr := tx.ExecContext(ctx, updateQuery, account.Balance, account.Currency, existingID)
		if updateErr != nil {
			return 0, false, fmt.Errorf("failed to update existing cash holding: %w", updateErr)
		}
		return existingID, false, nil
	}

	if err != sql.ErrNoRows {
		return 0, false, fmt.Errorf("error checking for existing cash holding: %w", err)
	}

	// Create new cash holding entry
	insertQuery := `
		INSERT INTO cash_holdings (
			institution_name, account_name, account_type, 
			current_balance, currency, account_number_last4, data_source, 
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'document_import', NOW(), NOW())
		RETURNING id`

	var cashHoldingID int
	err = tx.QueryRowContext(ctx, insertQuery,
		institution,
		account.Name,
		account.AccountType,
		account.Balance,
		account.Currency,
		last4,
	).Scan(&cashHoldingID)

	if err != nil {
		return 0, false, fmt.Errorf("failed to create cash holding: %w", err)
	}

	return cashHoldingID, true, nil
}

// createDefaultAccount creates a default account for transactions
// DEPRECATED: This function is no longer used in the new architecture
// Accounts are now imported directly to cash_holdings table via importAccount function
func (s *Server) createDefaultAccount(ctx context.Context, tx *sql.Tx, institution string) (int, bool, error) {
	return 0, false, fmt.Errorf("createDefaultAccount is deprecated - accounts table no longer exists")
}

// createDefaultInvestmentAccount creates a default investment account for holdings
// DEPRECATED: This function is no longer used in the new architecture
// Stock holdings are now imported directly to stock_holdings table with institution_name
func (s *Server) createDefaultInvestmentAccount(ctx context.Context, tx *sql.Tx, institution string) (int, bool, error) {
	return 0, false, fmt.Errorf("createDefaultInvestmentAccount is deprecated - accounts table no longer exists")
}

// importTransaction imports a transaction
func (s *Server) importTransaction(ctx context.Context, tx *sql.Tx, transaction *services.ExtractedTransaction, accountID int) error {
	// Note: We're not importing transactions into a transactions table since it doesn't exist in current schema
	// This is a placeholder for future transaction import functionality
	log.Printf("Would import transaction: %s, %f, %s (account %d)", 
		transaction.Description, transaction.Amount, transaction.Date, accountID)
	return nil
}

// importHolding imports a stock holding
func (s *Server) importHolding(ctx context.Context, tx *sql.Tx, holding *services.ExtractedHolding, institution string) error {
	log.Printf("Importing holding: %s - %f shares @ %f (value: %f, cost_basis: %f) from %s", 
		holding.Symbol, holding.Shares, holding.Price, holding.Value, holding.CostBasis, institution)
	
	// Check if holding already exists
	var existingID int
	query := `SELECT id FROM stock_holdings WHERE symbol = $1 AND institution_name = $2 LIMIT 1`
	err := tx.QueryRowContext(ctx, query, holding.Symbol, institution).Scan(&existingID)
	
	if err == nil {
		// Update existing holding
		log.Printf("Updating existing holding %s (ID: %d)", holding.Symbol, existingID)
		updateQuery := `
			UPDATE stock_holdings 
			SET shares_owned = $1, current_price = $2, cost_basis = $3, data_source = 'document_import', last_updated = NOW()
			WHERE id = $4`
		
		var costBasisPtr *float64
		if holding.CostBasis > 0 {
			costBasisPtr = &holding.CostBasis
		}
		
		_, err = tx.ExecContext(ctx, updateQuery, holding.Shares, holding.Price, costBasisPtr, existingID)
		if err != nil {
			log.Printf("Failed to update holding %s: %v", holding.Symbol, err)
		} else {
			log.Printf("Successfully updated holding %s", holding.Symbol)
		}
		return err
	}

	if err != sql.ErrNoRows {
		return fmt.Errorf("error checking for existing holding: %w", err)
	}

	// Create new holding
	log.Printf("Creating new holding %s", holding.Symbol)
	insertQuery := `
		INSERT INTO stock_holdings 
		(symbol, company_name, shares_owned, current_price, cost_basis, institution_name, 
		 data_source, is_vested_equity, created_at, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, 'document_import', false, NOW(), NOW())`

	var costBasisPtr *float64
	if holding.CostBasis > 0 {
		costBasisPtr = &holding.CostBasis
	}

	_, err = tx.ExecContext(ctx, insertQuery,
		holding.Symbol,
		holding.Description,
		holding.Shares,
		holding.Price,
		costBasisPtr,
		institution,
	)

	if err != nil {
		log.Printf("Failed to create holding %s: %v", holding.Symbol, err)
	} else {
		log.Printf("Successfully created holding %s", holding.Symbol)
	}

	return err
}

// importCrypto imports a cryptocurrency holding
func (s *Server) importCrypto(ctx context.Context, tx *sql.Tx, crypto *services.ExtractedCrypto, institution string) error {
	log.Printf("Importing crypto: %s - %f balance @ %f (value: %f) from %s [wallet: %s]", 
		crypto.Symbol, crypto.Balance, crypto.Price, crypto.Value, institution, crypto.WalletType)
	
	// Check if crypto holding already exists
	var existingID int
	query := `SELECT id FROM crypto_holdings WHERE crypto_symbol = $1 AND institution_name = $2 LIMIT 1`
	err := tx.QueryRowContext(ctx, query, crypto.Symbol, institution).Scan(&existingID)
	
	if err == nil {
		// Update existing crypto holding
		log.Printf("Updating existing crypto holding %s (ID: %d)", crypto.Symbol, existingID)
		updateQuery := `
			UPDATE crypto_holdings 
			SET balance_tokens = $1, purchase_price_usd = $2, data_source = 'document_import', updated_at = NOW()
			WHERE id = $3`
		
		_, err = tx.ExecContext(ctx, updateQuery, crypto.Balance, crypto.Price, existingID)
		if err != nil {
			log.Printf("Failed to update crypto holding %s: %v", crypto.Symbol, err)
		} else {
			log.Printf("Successfully updated crypto holding %s", crypto.Symbol)
		}
		return err
	}

	if err != sql.ErrNoRows {
		return fmt.Errorf("error checking for existing crypto holding: %w", err)
	}

	// Create new crypto holding
	log.Printf("Creating new crypto holding %s", crypto.Symbol)
	insertQuery := `
		INSERT INTO crypto_holdings 
		(institution_name, crypto_symbol, balance_tokens, 
		 purchase_price_usd, notes, data_source, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, 'document_import', NOW(), NOW())`

	notes := crypto.Description
	if crypto.WalletType != "" {
		if notes != "" {
			notes = fmt.Sprintf("Wallet Type: %s | %s", crypto.WalletType, notes)
		} else {
			notes = fmt.Sprintf("Wallet Type: %s", crypto.WalletType)
		}
	}

	_, err = tx.ExecContext(ctx, insertQuery,
		institution,
		crypto.Symbol,
		crypto.Balance,
		crypto.Price, // Use current price as purchase price for lack of better data
		notes,
	)

	if err != nil {
		log.Printf("Failed to create crypto holding %s: %v", crypto.Symbol, err)
	} else {
		log.Printf("Successfully created crypto holding %s", crypto.Symbol)
	}

	return err
}

// updateJobStatus updates the status of a document processing job
func (s *Server) updateJobStatus(ctx context.Context, jobID int, status string) error {
	query := `UPDATE document_processing_jobs SET processing_status = $1, updated_at = NOW() WHERE id = $2`
	_, err := s.db.ExecContext(ctx, query, status, jobID)
	return err
}

// @Summary List document processing jobs
// @Description Retrieve a paginated list of document processing jobs
// @Tags documents
// @Accept json
// @Produce json
// @Param limit query int false "Number of jobs to return (default: 20, max: 100)"
// @Param offset query int false "Number of jobs to skip (default: 0)"
// @Success 200 {object} map[string]interface{} "List of document jobs"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents [get]
func (s *Server) listDocuments(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	jobs, err := s.documentProcessor.ListJobs(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to list document jobs: %v", err),
		})
		return
	}

	// Convert jobs to response format
	var jobsResponse []map[string]interface{}
	for _, job := range jobs {
		jobMap := map[string]interface{}{
			"id":                job.ID,
			"filename":          job.Filename,
			"file_type":         job.FileType,
			"file_size":         job.FileSize,
			"processing_status": job.ProcessingStatus,
			"created_at":        job.CreatedAt,
			"updated_at":        job.UpdatedAt,
		}

		if job.ErrorMessage != nil {
			jobMap["error_message"] = *job.ErrorMessage
		}

		jobsResponse = append(jobsResponse, jobMap)
	}

	c.JSON(http.StatusOK, gin.H{
		"jobs":   jobsResponse,
		"count":  len(jobsResponse),
		"limit":  limit,
		"offset": offset,
	})
}

// @Summary Process document with LLM
// @Description Start LLM processing of an uploaded document
// @Tags documents
// @Accept json
// @Produce json
// @Param id path int true "Document job ID"
// @Success 200 {object} map[string]interface{} "Document processing started"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid status"
// @Failure 404 {object} map[string]interface{} "Job not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents/{id}/process [post]
func (s *Server) processDocument(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid job ID",
		})
		return
	}

	// Check if job exists and is in correct status
	job, err := s.documentProcessor.GetJob(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "job not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Document job not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to get document job: %v", err),
			})
		}
		return
	}

	if job.ProcessingStatus != "uploaded" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Cannot process document in status '%s'. Expected 'uploaded'", job.ProcessingStatus),
		})
		return
	}

	// Start processing asynchronously
	go func() {
		if err := s.documentProcessor.ProcessDocument(context.Background(), id); err != nil {
			fmt.Printf("ERROR: Failed to process document %d: %v\n", id, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Document processing started",
		"job_id":  id,
		"status":  "processing",
	})
}

// ApprovalRequest represents the request body for document approval
type ApprovalRequest struct {
	InstitutionName *string `json:"institution_name,omitempty"` // Optional override for institution name
}

// @Summary Approve processed document
// @Description Approve and import the extracted data from a processed document with optional institution name override
// @Tags documents
// @Accept json
// @Produce json
// @Param id path int true "Document job ID"
// @Param body body ApprovalRequest false "Optional approval parameters"
// @Success 200 {object} map[string]interface{} "Document data imported successfully"
// @Failure 400 {object} map[string]interface{} "Bad request or invalid status"
// @Failure 404 {object} map[string]interface{} "Job not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents/{id}/approve [post]
func (s *Server) approveDocument(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid job ID",
		})
		return
	}

	// Parse optional approval request body
	var approvalReq ApprovalRequest
	if err := c.ShouldBindJSON(&approvalReq); err != nil {
		// If binding fails, continue with default values (empty request body is fine)
		log.Printf("Failed to parse approval request body (using defaults): %v", err)
	}

	// Check if job exists and is in correct status
	job, err := s.documentProcessor.GetJob(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "job not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Document job not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to get document job: %v", err),
			})
		}
		return
	}

	if job.ProcessingStatus != "completed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Cannot approve document in status '%s'. Expected 'completed'", job.ProcessingStatus),
		})
		return
	}

	if job.ExtractedData == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No extracted data available for approval",
		})
		return
	}

	// Parse extracted data
	var extractedData services.FinancialDocumentData
	if err := json.Unmarshal([]byte(*job.ExtractedData), &extractedData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Failed to parse extracted data: %v", err),
		})
		return
	}

	// Apply institution name override if provided
	if approvalReq.InstitutionName != nil && strings.TrimSpace(*approvalReq.InstitutionName) != "" {
		log.Printf("Overriding institution name from '%s' to '%s' for job %d", 
			extractedData.Institution, *approvalReq.InstitutionName, id)
		extractedData.Institution = strings.TrimSpace(*approvalReq.InstitutionName)
	}

	// Import the data into the dashboard
	log.Printf("Starting data import for job %d", id)
	importResult, err := s.importExtractedData(c.Request.Context(), &extractedData)
	if err != nil {
		log.Printf("Data import failed for job %d: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("Failed to import data: %v", err),
		})
		return
	}
	log.Printf("Data import successful for job %d: %+v", id, importResult)

	// Update job status to approved
	if err := s.updateJobStatus(c.Request.Context(), id, "approved"); err != nil {
		// Log the error but don't fail the response since data was imported
		log.Printf("Warning: Failed to update job status to approved: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":              true,
		"message":              "Document data successfully imported",
		"job_id":               id,
		"imported_accounts":    importResult.ImportedAccounts,
		"imported_transactions": importResult.ImportedTransactions,
		"imported_holdings":    importResult.ImportedHoldings,
		"import_details":       importResult,
	})
}

// @Summary Delete document processing job
// @Description Delete a document processing job and its associated files
// @Tags documents
// @Accept json
// @Produce json
// @Param id path int true "Document job ID"
// @Success 200 {object} map[string]interface{} "Document deleted successfully"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Job not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Failure 503 {object} map[string]interface{} "LLM feature disabled"
// @Router /documents/{id} [delete]
func (s *Server) deleteDocument(c *gin.Context) {
	// Check if LLM feature is enabled
	if !s.config.API.LLMEnabled || s.documentProcessor == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":           "LLM document processing feature is disabled",
			"feature_enabled": false,
		})
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid job ID",
		})
		return
	}

	// Get job to check if it exists and get file path
	job, err := s.documentProcessor.GetJob(c.Request.Context(), id)
	if err != nil {
		if err.Error() == "job not found" {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Document job not found",
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to get document job: %v", err),
			})
		}
		return
	}

	// Delete file from filesystem
	if err := os.Remove(job.FilePath); err != nil && !os.IsNotExist(err) {
		fmt.Printf("WARNING: Failed to delete file %s: %v\n", job.FilePath, err)
	}

	// Delete job from database
	query := "DELETE FROM document_processing_jobs WHERE id = $1"
	result, err := s.db.Exec(query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete document job",
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
			"error": "Document job not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Document deleted successfully",
		"job_id":  id,
	})
}

// getDocumentHealth returns the health status of the document processing system
// @Summary Get document processing system health
// @Description Get health status information about the LLM document processing system
// @Tags documents
// @Produce json
// @Success 200 {object} map[string]interface{} "Health status information"
// @Router /documents/health [get]
func (s *Server) getDocumentHealth(c *gin.Context) {
	// Check if upload directory is writable
	uploadDirWritable := true
	uploadDir := s.config.API.LLMUploadDir
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	// Try to create upload directory if it doesn't exist
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		uploadDirWritable = false
	} else {
		// Test write access by creating a temporary file
		testFile := filepath.Join(uploadDir, ".write_test")
		if file, err := os.Create(testFile); err != nil {
			uploadDirWritable = false
		} else {
			file.Close()
			os.Remove(testFile) // Clean up test file
		}
	}

	// Count pending jobs
	var pendingJobs int
	query := `SELECT COUNT(*) FROM document_processing_jobs WHERE processing_status IN ('uploaded', 'processing')`
	err := s.db.QueryRow(query).Scan(&pendingJobs)
	if err != nil {
		pendingJobs = 0 // Default to 0 if query fails
	}

	// Determine LLM status
	llmStatus := "disabled"
	if s.config.API.LLMEnabled {
		if s.documentProcessor != nil {
			llmStatus = "enabled"
		} else {
			llmStatus = "enabled_but_not_initialized"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"llm_enabled":         s.config.API.LLMEnabled,
		"llm_status":          llmStatus,
		"upload_dir_writable": uploadDirWritable,
		"pending_jobs":        pendingJobs,
		"upload_directory":    uploadDir,
		"llm_model":           s.config.API.LLMModel,
		"llm_base_url":        s.config.API.LLMBaseURL,
	})
}

// Scenario handlers for what-if analysis

// @Summary Get all scenarios
// @Description Retrieve all saved what-if scenarios
// @Tags scenarios
// @Accept json
// @Produce json
// @Success 200 {array} object "List of scenarios"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios [get]
func (s *Server) getScenarios(c *gin.Context) {
	scenarios, err := s.scenarioService.GetScenarios()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve scenarios",
		})
		return
	}

	c.JSON(http.StatusOK, scenarios)
}

// @Summary Get default scenario parameters
// @Description Get suggested default parameters for asset classes
// @Tags scenarios
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Default parameters for asset classes"
// @Router /scenarios/default-parameters [get]
func (s *Server) getDefaultScenarioParameters(c *gin.Context) {
	defaults := s.scenarioService.GetDefaultParameters()
	
	// Get available crypto symbols for individual parameter configuration
	cryptoSymbols, err := s.scenarioService.GetAvailableCryptoSymbols()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to get available crypto symbols",
		})
		return
	}
	
	response := gin.H{
		"default_parameters": defaults,
		"available_crypto_symbols": cryptoSymbols,
	}
	
	c.JSON(http.StatusOK, response)
}

// @Summary Create a new scenario
// @Description Create a new what-if scenario with parameters
// @Tags scenarios
// @Accept json
// @Produce json
// @Param request body object true "Scenario configuration"
// @Success 201 {object} object "Created scenario"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios [post]
func (s *Server) createScenario(c *gin.Context) {
	var scenario services.Scenario
	if err := c.ShouldBindJSON(&scenario); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}

	// Validate required fields
	if scenario.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Scenario name is required",
		})
		return
	}

	if scenario.TimeHorizonYears <= 0 || scenario.TimeHorizonYears > 30 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Time horizon must be between 1 and 30 years",
		})
		return
	}

	if len(scenario.Parameters) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one asset class parameter is required",
		})
		return
	}

	err := s.scenarioService.CreateScenario(&scenario)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create scenario",
		})
		return
	}

	c.JSON(http.StatusCreated, scenario)
}

// @Summary Get a specific scenario
// @Description Retrieve a scenario by ID with its parameters
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Success 200 {object} object "Scenario details"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id} [get]
func (s *Server) getScenario(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	scenario, err := s.scenarioService.GetScenario(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Scenario not found",
		})
		return
	}

	c.JSON(http.StatusOK, scenario)
}

// @Summary Update a scenario
// @Description Update an existing scenario configuration
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Param request body object true "Updated scenario configuration"
// @Success 200 {object} object "Updated scenario"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id} [put]
func (s *Server) updateScenario(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	var scenario services.Scenario
	if err := c.ShouldBindJSON(&scenario); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}

	scenario.ID = id

	err = s.scenarioService.UpdateScenario(&scenario)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update scenario",
		})
		return
	}

	c.JSON(http.StatusOK, scenario)
}

// @Summary Delete a scenario
// @Description Delete a scenario and all its data
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Success 200 {object} map[string]interface{} "Scenario deleted successfully"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id} [delete]
func (s *Server) deleteScenario(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	err = s.scenarioService.DeleteScenario(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete scenario",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Scenario deleted successfully",
	})
}

// @Summary Calculate scenario projections
// @Description Calculate what-if projections for a scenario
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Success 200 {array} object "Projection results"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id}/calculate [post]
func (s *Server) calculateScenario(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	results, err := s.scenarioService.CalculateScenario(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to calculate scenario",
		})
		return
	}

	c.JSON(http.StatusOK, results)
}

// @Summary Get scenario results
// @Description Get stored projection results for a scenario
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Success 200 {array} object "Projection results"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id}/results [get]
func (s *Server) getScenarioResults(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	results, err := s.scenarioService.GetScenarioResults(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve scenario results",
		})
		return
	}

	c.JSON(http.StatusOK, results)
}

// @Summary Export scenario
// @Description Export scenario data and projections
// @Tags scenarios
// @Accept json
// @Produce json
// @Param id path int true "Scenario ID"
// @Param format query string false "Export format (json, csv, pdf, html)" default(json)
// @Success 200 {object} map[string]interface{} "Export data"
// @Failure 404 {object} map[string]interface{} "Scenario not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/{id}/export [get]
func (s *Server) exportScenario(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid scenario ID",
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	
	// Get scenario with results
	scenario, err := s.scenarioService.GetScenario(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Scenario not found",
		})
		return
	}

	results, err := s.scenarioService.GetScenarioResults(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve scenario results",
		})
		return
	}

	// Get current portfolio for context
	portfolio, err := s.scenarioService.GetCurrentPortfolio()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to retrieve current portfolio",
		})
		return
	}

	// Prepare export data
	exportData := gin.H{
		"scenario":           scenario,
		"results":           results,
		"current_portfolio": portfolio,
		"exported_at":       time.Now().Format(time.RFC3339),
		"format":            format,
	}

	switch format {
	case "json":
		c.JSON(http.StatusOK, exportData)
	case "csv":
		// Generate CSV data
		csvData, err := s.generateCSVExport(exportData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate CSV export",
			})
			return
		}
		
		// Set CSV headers
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=scenario_%s_%s.csv", 
			scenario.Name, time.Now().Format("2006-01-02")))
		c.String(http.StatusOK, csvData)
	case "pdf":
		// TODO: Implement PDF export
		c.JSON(http.StatusNotImplemented, gin.H{
			"error": "PDF export not yet implemented",
		})
	case "html":
		// Generate HTML report
		htmlData, err := s.generateHTMLExport(exportData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate HTML export",
			})
			return
		}
		
		// Set HTML headers
		c.Header("Content-Type", "text/html")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=scenario_%s_%s.html", 
			scenario.Name, time.Now().Format("2006-01-02")))
		c.String(http.StatusOK, htmlData)
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Unsupported export format",
		})
	}
}

// @Summary Compare multiple scenarios
// @Description Compare projection results from multiple scenarios
// @Tags scenarios
// @Accept json
// @Produce json
// @Param request body object true "Scenario IDs to compare"
// @Success 200 {object} map[string]interface{} "Comparison results"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /scenarios/compare [post]
func (s *Server) compareScenarios(c *gin.Context) {
	var request struct {
		ScenarioIds []int `json:"scenario_ids"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request data",
		})
		return
	}
	
	if len(request.ScenarioIds) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least 2 scenarios are required for comparison",
		})
		return
	}
	
	// Get scenarios and their results
	comparison := make(map[string]interface{})
	scenarioData := make([]map[string]interface{}, 0)
	
	for _, id := range request.ScenarioIds {
		scenario, err := s.scenarioService.GetScenario(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error": fmt.Sprintf("Scenario %d not found", id),
			})
			return
		}
		
		results, err := s.scenarioService.GetScenarioResults(id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": fmt.Sprintf("Failed to get results for scenario %d", id),
			})
			return
		}
		
		scenarioData = append(scenarioData, map[string]interface{}{
			"scenario": scenario,
			"results":  results,
		})
	}
	
	comparison["scenarios"] = scenarioData
	comparison["compared_at"] = time.Now().Format(time.RFC3339)
	
	c.JSON(http.StatusOK, comparison)
}

// generateCSVExport creates a CSV export of scenario data
func (s *Server) generateCSVExport(exportData gin.H) (string, error) {
	scenario := exportData["scenario"].(*services.Scenario)
	results := exportData["results"].([]services.ScenarioResult)
	portfolio := exportData["current_portfolio"].(*services.CurrentPortfolio)
	
	var buffer bytes.Buffer
	
	// Add scenario metadata as comments
	buffer.WriteString(fmt.Sprintf("# Scenario: %s\n", scenario.Name))
	buffer.WriteString(fmt.Sprintf("# Description: %s\n", scenario.Description))
	buffer.WriteString(fmt.Sprintf("# Time Horizon: %d years\n", scenario.TimeHorizonYears))
	buffer.WriteString(fmt.Sprintf("# Bitcoin Allocation: %.1f%%\n", scenario.BitcoinAllocationPercentage))
	buffer.WriteString(fmt.Sprintf("# Rebalancing: %s\n", scenario.RebalancingFrequency))
	buffer.WriteString(fmt.Sprintf("# Exported: %s\n", exportData["exported_at"]))
	buffer.WriteString("\n")
	
	// Add current portfolio summary
	buffer.WriteString("# Current Portfolio Summary:\n")
	buffer.WriteString(fmt.Sprintf("# Total Value: $%.2f\n", portfolio.TotalValue))
	buffer.WriteString(fmt.Sprintf("# Stocks: $%.2f\n", portfolio.StockValue))
	buffer.WriteString(fmt.Sprintf("# Crypto: $%.2f\n", portfolio.CryptoValue))
	buffer.WriteString(fmt.Sprintf("# Real Estate: $%.2f\n", portfolio.RealEstateValue))
	buffer.WriteString(fmt.Sprintf("# Cash: $%.2f\n", portfolio.CashValue))
	buffer.WriteString(fmt.Sprintf("# Other Assets: $%.2f\n", portfolio.OtherAssetsValue))
	buffer.WriteString("\n")
	
	// Create CSV writer
	csvWriter := csv.NewWriter(&buffer)
	
	// Write CSV headers
	headers := []string{
		"Year",
		"Net Worth USD",
		"Net Worth BTC", 
		"BTC Price",
		"Stock Value",
		"Crypto Value",
		"Real Estate Value",
		"Cash Value",
		"Other Assets Value",
	}
	if err := csvWriter.Write(headers); err != nil {
		return "", fmt.Errorf("error writing CSV headers: %w", err)
	}
	
	// Write data rows
	for _, result := range results {
		yearStr := "Current"
		if result.ProjectionYear > 0 {
			yearStr = fmt.Sprintf("Year %d", result.ProjectionYear)
		}
		
		record := []string{
			yearStr,
			fmt.Sprintf("%.2f", result.TotalNetWorth),
			fmt.Sprintf("%.6f", result.NetWorthInBTC),
			fmt.Sprintf("%.2f", result.ProjectedBitcoinPrice),
			fmt.Sprintf("%.2f", result.StockValue),
			fmt.Sprintf("%.2f", result.CryptoValue),
			fmt.Sprintf("%.2f", result.RealEstateValue),
			fmt.Sprintf("%.2f", result.CashValue),
			fmt.Sprintf("%.2f", result.OtherAssetsValue),
		}
		
		if err := csvWriter.Write(record); err != nil {
			return "", fmt.Errorf("error writing CSV record: %w", err)
		}
	}
	
	// Flush the writer
	csvWriter.Flush()
	if err := csvWriter.Error(); err != nil {
		return "", fmt.Errorf("error flushing CSV writer: %w", err)
	}
	
	return buffer.String(), nil
}

// generateHTMLExport creates an HTML report with embedded charts
func (s *Server) generateHTMLExport(exportData gin.H) (string, error) {
	scenario := exportData["scenario"].(*services.Scenario)
	results := exportData["results"].([]services.ScenarioResult)
	portfolio := exportData["current_portfolio"].(*services.CurrentPortfolio)
	
	// Generate chart data for JavaScript
	chartData := "["
	for i, result := range results {
		if i > 0 {
			chartData += ","
		}
		
		yearStr := fmt.Sprintf("%d", result.ProjectionYear)
		yearLabel := "Current"
		if result.ProjectionYear > 0 {
			yearLabel = fmt.Sprintf("Year %d", result.ProjectionYear)
		}
		
		chartData += fmt.Sprintf(`{
			"year": %s,
			"yearLabel": "%s",
			"total_net_worth": %.2f,
			"stock_value": %.2f,
			"crypto_value": %.2f,
			"real_estate_value": %.2f,
			"cash_value": %.2f,
			"other_assets_value": %.2f,
			"bitcoin_price": %.2f
		}`, yearStr, 
		yearLabel,
		result.TotalNetWorth,
		result.StockValue,
		result.CryptoValue,
		result.RealEstateValue,
		result.CashValue,
		result.OtherAssetsValue,
		result.ProjectedBitcoinPrice)
	}
	chartData += "]"
	
	// Pre-calculate all values to avoid complex sprintf arguments
	scenarioName := scenario.Name
	generatedDate := time.Now().Format("January 2, 2006")
	description := scenario.Description
	if description == "" {
		description = "No description provided"
	}
	timeHorizon := scenario.TimeHorizonYears
	bitcoinAllocation := scenario.BitcoinAllocationPercentage
	rebalancing := scenario.RebalancingFrequency
	currentPortfolioValue := portfolio.TotalValue
	
	// Calculate final values
	var finalNetWorth float64
	var growthMultiple float64
	var totalGrowth float64
	
	if len(results) > 0 {
		finalNetWorth = results[len(results)-1].TotalNetWorth
		if currentPortfolioValue > 0 {
			growthMultiple = finalNetWorth / currentPortfolioValue
		} else {
			growthMultiple = 1.0
		}
		totalGrowth = finalNetWorth - currentPortfolioValue
	} else {
		finalNetWorth = currentPortfolioValue
		growthMultiple = 1.0
		totalGrowth = 0
	}
	
	// Generate table rows
	tableRows := ""
	for _, result := range results {
		yearStr := "Current"
		if result.ProjectionYear > 0 {
			yearStr = fmt.Sprintf("Year %d", result.ProjectionYear)
		}
		
		// Format numbers with smart abbreviations
		formatCurrency := func(amount float64) string {
			if amount >= 1e9 {
				return fmt.Sprintf("$%.1fB", amount/1e9)
			} else if amount >= 1e6 {
				return fmt.Sprintf("$%.1fM", amount/1e6)
			} else if amount >= 1e3 {
				return fmt.Sprintf("$%.0fK", amount/1e3)
			}
			return fmt.Sprintf("$%.0f", amount)
		}
		
		tableRows += fmt.Sprintf(`
                        <tr>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                            <td>%s</td>
                        </tr>`,
			yearStr,
			formatCurrency(result.TotalNetWorth),
			formatCurrency(result.ProjectedBitcoinPrice),
			formatCurrency(result.StockValue),
			formatCurrency(result.CryptoValue),
			formatCurrency(result.RealEstateValue),
			formatCurrency(result.CashValue),
			formatCurrency(result.OtherAssetsValue))
	}

	// Full template
	htmlTemplate := `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - Scenario Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f9fafb;
            color: #111827;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #64748b;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .summary-card .value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1e293b;
        }
        .chart-container {
            margin: 30px 0;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            position: relative;
        }
        .chart-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 20px;
            color: #1e293b;
        }
        .chart-wrapper {
            position: relative;
            height: 400px;
            width: 100%%;
        }
        .chart-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%% !important;
            height: 100%% !important;
        }
        .data-table {
            margin-top: 30px;
            overflow-x: auto;
        }
        .data-table table {
            width: 100%%;
            border-collapse: collapse;
            font-size: 0.875rem;
        }
        .data-table th,
        .data-table td {
            padding: 12px;
            text-align: right;
            border-bottom: 1px solid #e2e8f0;
        }
        .data-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #374151;
        }
        .data-table th:first-child,
        .data-table td:first-child {
            text-align: left;
        }
        .scenario-details {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .scenario-details h3 {
            margin: 0 0 15px 0;
            color: #1e293b;
        }
        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .detail-item {
            display: flex;
            justify-content: space-between;
        }
        .detail-label {
            color: #64748b;
            font-weight: 500;
        }
        .detail-value {
            color: #1e293b;
            font-weight: 600;
        }
        @media print {
            body { background: white; }
            .container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>%s</h1>
            <p>Net Worth Projection Report</p>
            <p>Generated on %s</p>
        </div>
        
        <div class="content">
            <!-- Scenario Details -->
            <div class="scenario-details">
                <h3>Scenario Configuration</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">%s</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Time Horizon:</span>
                        <span class="detail-value">%v years</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Bitcoin Allocation:</span>
                        <span class="detail-value">%v%%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Rebalancing:</span>
                        <span class="detail-value">%s</span>
                    </div>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Current Portfolio Value</h3>
                    <div class="value">$%.0f</div>
                </div>
                <div class="summary-card">
                    <h3>Final Net Worth</h3>
                    <div class="value">$%.0f</div>
                </div>
                <div class="summary-card">
                    <h3>Growth Multiple</h3>
                    <div class="value">%.1fx</div>
                </div>
                <div class="summary-card">
                    <h3>Total Growth</h3>
                    <div class="value">$%.0f</div>
                </div>
            </div>

            <!-- Wealth Growth Chart -->
            <div class="chart-container">
                <h3 class="chart-title">Wealth Growth Over Time</h3>
                <div class="chart-wrapper">
                    <canvas id="wealthChart" class="chart-canvas"></canvas>
                </div>
            </div>

            <!-- Asset Allocation Chart -->
            <div class="chart-container">
                <h3 class="chart-title">Asset Allocation Evolution</h3>
                <div class="chart-wrapper">
                    <canvas id="allocationChart" class="chart-canvas"></canvas>
                </div>
            </div>

            <!-- Bitcoin Price Chart -->
            <div class="chart-container">
                <h3 class="chart-title">Bitcoin Price Projection</h3>
                <div class="chart-wrapper">
                    <canvas id="bitcoinChart" class="chart-canvas"></canvas>
                </div>
            </div>

            <!-- Data Table -->
            <div class="data-table">
                <h3 class="chart-title">Detailed Projections</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Year</th>
                            <th>Net Worth (USD)</th>
                            <th>Bitcoin Price</th>
                            <th>Stocks</th>
                            <th>Crypto</th>
                            <th>Real Estate</th>
                            <th>Cash</th>
                            <th>Other Assets</th>
                        </tr>
                    </thead>
                    <tbody>%s</tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        const data = %s;
        
        // Wealth Growth Chart
        const wealthCtx = document.getElementById('wealthChart').getContext('2d');
        new Chart(wealthCtx, {
            type: 'line',
            data: {
                labels: data.map(d => d.yearLabel),
                datasets: [{
                    label: 'Net Worth',
                    data: data.map(d => d.total_net_worth),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 0,
                devicePixelRatio: 1,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Net Worth: $$' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // Asset Allocation Chart
        const allocationCtx = document.getElementById('allocationChart').getContext('2d');
        new Chart(allocationCtx, {
            type: 'line',
            data: {
                labels: data.map(d => d.yearLabel),
                datasets: [
                    {
                        label: 'Stocks',
                        data: data.map(d => d.stock_value),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.3)',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Crypto',
                        data: data.map(d => d.crypto_value),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.3)',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Real Estate',
                        data: data.map(d => d.real_estate_value),
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.3)',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Cash',
                        data: data.map(d => d.cash_value),
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.3)',
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Other Assets',
                        data: data.map(d => d.other_assets_value),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.3)',
                        stack: 'Stack 0'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 0,
                devicePixelRatio: 1,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Year'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            callback: function(value) {
                                return '$$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $$' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // Bitcoin Price Chart
        const bitcoinCtx = document.getElementById('bitcoinChart').getContext('2d');
        new Chart(bitcoinCtx, {
            type: 'line',
            data: {
                labels: data.map(d => d.yearLabel),
                datasets: [{
                    label: 'Bitcoin Price',
                    data: data.map(d => d.bitcoin_price),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 0,
                devicePixelRatio: 1,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$$' + value.toLocaleString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Bitcoin Price: $$' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                }
            }
        });

        // Prevent infinite chart resizing by debouncing resize events
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                Chart.instances.forEach(function(chart) {
                    chart.resize();
                });
            }, 300);
        });
    </script>
</body>
</html>`
	
	return fmt.Sprintf(htmlTemplate,
		scenarioName,           // 1. title (line 5849)
		scenarioName,           // 2. h1 text (line 5998)
		generatedDate,          // 3. generated date (line 6000)
		description,            // 4. description (line 6010)
		timeHorizon,            // 5. time horizon years (line 6014)
		bitcoinAllocation,      // 6. bitcoin allocation percentage (line 6018)
		rebalancing,            // 7. rebalancing frequency (line 6022)
		currentPortfolioValue,  // 8. current portfolio value (line 6031)
		finalNetWorth,          // 9. final net worth (line 6035)
		growthMultiple,         // 10. growth multiple (line 6039)
		totalGrowth,            // 11. total growth (line 6043)
		tableRows,              // 12. table rows (line 6087)
		chartData), nil         // 13. chart data (line 6094)
}
