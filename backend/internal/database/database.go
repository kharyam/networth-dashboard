package database

import (
	"database/sql"
	"fmt"

	"networth-dashboard/internal/config"

	_ "github.com/lib/pq"
)

type DB struct {
	*sql.DB
}

func Initialize(cfg config.DatabaseConfig) (*DB, error) {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode)

	sqlDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(25)

	db := &DB{sqlDB}

	// Run migrations
	if err := db.runMigrations(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

func (db *DB) runMigrations() error {
	// Create tables if they don't exist
	migrations := []string{
		createCredentialsTable,
		createDataSourcesTable,
		createAccountsTable,
		createAccountBalancesTable,
		createManualEntriesTable,
		createManualEntryLogTable,
		createStockHoldingsTable,
		createStockPricesTable,
		createEquityGrantsTable,
		createVestingScheduleTable,
		createRealEstatePropertiesTable,
		createCashHoldingsTable,
		createMiscellaneousAssetsTable,
		createNetWorthSnapshotsTable,
		createCryptoHoldingsTable,
		createCryptoPricesTable,
		updateEquityGrantsTable,
		updateRealEstateAddressFields,
		createIndices,
	}

	for _, migration := range migrations {
		if _, err := db.Exec(migration); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}

	return nil
}