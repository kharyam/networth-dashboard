package models

import (
	"time"
)

// Core data structures for the financial dashboard

type DataSource struct {
	ID           int                    `json:"id" db:"id"`
	Name         string                 `json:"name" db:"name"`
	Type         string                 `json:"type" db:"type"`
	Status       string                 `json:"status" db:"status"`
	ConfigSchema map[string]interface{} `json:"config_schema" db:"config_schema"`
	CreatedAt    time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
}

type Account struct {
	ID                int       `json:"id" db:"id"`
	DataSourceID      *int      `json:"data_source_id" db:"data_source_id"`
	ExternalAccountID *string   `json:"external_account_id" db:"external_account_id"`
	AccountName       string    `json:"account_name" db:"account_name"`
	AccountType       string    `json:"account_type" db:"account_type"`
	Institution       string    `json:"institution" db:"institution"`
	DataSourceType    string    `json:"data_source_type" db:"data_source_type"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

type AccountBalance struct {
	ID         int       `json:"id" db:"id"`
	AccountID  int       `json:"account_id" db:"account_id"`
	Balance    float64   `json:"balance" db:"balance"`
	Currency   string    `json:"currency" db:"currency"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
	DataSource string    `json:"data_source" db:"data_source"`
}

type ManualEntry struct {
	ID        int                    `json:"id" db:"id"`
	AccountID int                    `json:"account_id" db:"account_id"`
	EntryType string                 `json:"entry_type" db:"entry_type"`
	DataJSON  map[string]interface{} `json:"data_json" db:"data_json"`
	CreatedAt time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt time.Time              `json:"updated_at" db:"updated_at"`
}

type ManualEntryLog struct {
	ID           int       `json:"id" db:"id"`
	AccountID    int       `json:"account_id" db:"account_id"`
	EntryType    string    `json:"entry_type" db:"entry_type"`
	FieldChanged string    `json:"field_changed" db:"field_changed"`
	OldValue     string    `json:"old_value" db:"old_value"`
	NewValue     string    `json:"new_value" db:"new_value"`
	UpdatedBy    string    `json:"updated_by" db:"updated_by"`
	Timestamp    time.Time `json:"timestamp" db:"timestamp"`
}

type StockHolding struct {
	ID                int       `json:"id" db:"id"`
	AccountID         int       `json:"account_id" db:"account_id"`
	Symbol            string    `json:"symbol" db:"symbol"`
	CompanyName       *string   `json:"company_name" db:"company_name"`
	SharesOwned       float64   `json:"shares_owned" db:"shares_owned"`
	CostBasis         *float64  `json:"cost_basis" db:"cost_basis"`
	CurrentPrice      *float64  `json:"current_price" db:"current_price"`
	MarketValue       *float64  `json:"market_value" db:"market_value"`
	DataSource        string    `json:"data_source" db:"data_source"`
	LastPriceUpdate   *time.Time `json:"last_price_update" db:"last_price_update"`
	LastManualUpdate  *time.Time `json:"last_manual_update" db:"last_manual_update"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type StockPrice struct {
	ID        int       `json:"id" db:"id"`
	Symbol    string    `json:"symbol" db:"symbol"`
	Price     float64   `json:"price" db:"price"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
	Source    string    `json:"source" db:"source"`
}

type EquityGrant struct {
	ID             int       `json:"id" db:"id"`
	AccountID      int       `json:"account_id" db:"account_id"`
	GrantID        *string   `json:"grant_id" db:"grant_id"`
	GrantType      string    `json:"grant_type" db:"grant_type"`
	CompanySymbol  *string   `json:"company_symbol" db:"company_symbol"`
	TotalShares    int       `json:"total_shares" db:"total_shares"`
	VestedShares   int       `json:"vested_shares" db:"vested_shares"`
	UnvestedShares int       `json:"unvested_shares" db:"unvested_shares"`
	StrikePrice    *float64  `json:"strike_price" db:"strike_price"`
	GrantDate      *time.Time `json:"grant_date" db:"grant_date"`
	VestStartDate  *time.Time `json:"vest_start_date" db:"vest_start_date"`
	DataSource     string    `json:"data_source" db:"data_source"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type VestingSchedule struct {
	ID               int       `json:"id" db:"id"`
	GrantID          int       `json:"grant_id" db:"grant_id"`
	VestDate         time.Time `json:"vest_date" db:"vest_date"`
	SharesVesting    int       `json:"shares_vesting" db:"shares_vesting"`
	CumulativeVested int       `json:"cumulative_vested" db:"cumulative_vested"`
	IsFutureVest     bool      `json:"is_future_vest" db:"is_future_vest"`
	DataSource       string    `json:"data_source" db:"data_source"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

type RealEstate struct {
	ID                    int        `json:"id" db:"id"`
	AccountID             int        `json:"account_id" db:"account_id"`
	PropertyType          string     `json:"property_type" db:"property_type"`
	PropertyName          string     `json:"property_name" db:"property_name"`
	StreetAddress         *string    `json:"street_address" db:"street_address"`
	City                  *string    `json:"city" db:"city"`
	State                 *string    `json:"state" db:"state"`
	ZipCode               *string    `json:"zip_code" db:"zip_code"`
	Latitude              *float64   `json:"latitude" db:"latitude"`
	Longitude             *float64   `json:"longitude" db:"longitude"`
	PurchasePrice         float64    `json:"purchase_price" db:"purchase_price"`
	CurrentValue          float64    `json:"current_value" db:"current_value"`
	OutstandingMortgage   float64    `json:"outstanding_mortgage" db:"outstanding_mortgage"`
	Equity                float64    `json:"equity" db:"equity"`
	PurchaseDate          time.Time  `json:"purchase_date" db:"purchase_date"`
	PropertySizeSqft      *float64   `json:"property_size_sqft" db:"property_size_sqft"`
	LotSizeAcres          *float64   `json:"lot_size_acres" db:"lot_size_acres"`
	RentalIncomeMonthly   *float64   `json:"rental_income_monthly" db:"rental_income_monthly"`
	PropertyTaxAnnual     *float64   `json:"property_tax_annual" db:"property_tax_annual"`
	Notes                 *string    `json:"notes" db:"notes"`
	APIEstimatedValue     *float64   `json:"api_estimated_value" db:"api_estimated_value"`
	APIEstimateDate       *time.Time `json:"api_estimate_date" db:"api_estimate_date"`
	APIProvider           *string    `json:"api_provider" db:"api_provider"`
	LastUpdated           time.Time  `json:"last_updated" db:"last_updated"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
}

type MiscellaneousAsset struct {
	ID           int       `json:"id" db:"id"`
	AccountID    int       `json:"account_id" db:"account_id"`
	AssetName    string    `json:"asset_name" db:"asset_name"`
	AssetType    *string   `json:"asset_type" db:"asset_type"`
	CurrentValue float64   `json:"current_value" db:"current_value"`
	Description  *string   `json:"description" db:"description"`
	LastUpdated  time.Time `json:"last_updated" db:"last_updated"`
}

type NetWorthSnapshot struct {
	ID                   int       `json:"id" db:"id"`
	TotalAssets          float64   `json:"total_assets" db:"total_assets"`
	TotalLiabilities     float64   `json:"total_liabilities" db:"total_liabilities"`
	NetWorth             float64   `json:"net_worth" db:"net_worth"`
	VestedEquityValue    *float64  `json:"vested_equity_value" db:"vested_equity_value"`
	UnvestedEquityValue  *float64  `json:"unvested_equity_value" db:"unvested_equity_value"`
	StockHoldingsValue   *float64  `json:"stock_holdings_value" db:"stock_holdings_value"`
	RealEstateEquity     *float64  `json:"real_estate_equity" db:"real_estate_equity"`
	Timestamp            time.Time `json:"timestamp" db:"timestamp"`
}

type Transaction struct {
	ID          int       `json:"id" db:"id"`
	AccountID   int       `json:"account_id" db:"account_id"`
	Type        string    `json:"type" db:"type"`
	Amount      float64   `json:"amount" db:"amount"`
	Currency    string    `json:"currency" db:"currency"`
	Description string    `json:"description" db:"description"`
	Date        time.Time `json:"date" db:"date"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// Response DTOs
type NetWorthSummary struct {
	NetWorth            float64   `json:"net_worth"`
	TotalAssets         float64   `json:"total_assets"`
	TotalLiabilities    float64   `json:"total_liabilities"`
	VestedEquityValue   float64   `json:"vested_equity_value"`
	UnvestedEquityValue float64   `json:"unvested_equity_value"`
	StockHoldingsValue  float64   `json:"stock_holdings_value"`
	RealEstateEquity    float64   `json:"real_estate_equity"`
	LastUpdated         time.Time `json:"last_updated"`
}

type AccountSummary struct {
	Account Account        `json:"account"`
	Balance AccountBalance `json:"balance"`
}

type StockConsolidation struct {
	Symbol          string  `json:"symbol"`
	CompanyName     string  `json:"company_name"`
	TotalShares     float64 `json:"total_shares"`
	TotalValue      float64 `json:"total_value"`
	CurrentPrice    float64 `json:"current_price"`
	UnrealizedGains float64 `json:"unrealized_gains"`
	Sources         []StockHolding `json:"sources"`
}