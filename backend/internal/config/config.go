package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Database DatabaseConfig
	Server   ServerConfig
	Security SecurityConfig
	API      ApiConfig
	Market   MarketConfig
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type ServerConfig struct {
	Port            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	CORSEnabled     bool
	CORSOrigins     []string
}

type SecurityConfig struct {
	JWTSecret       string
	EncryptionKey   string
	CredentialKey   string
	RateLimitEnable bool
	RateLimitRPS    int
}

type ApiConfig struct {
	AlphaVantageAPIKey     string
	AlphaVantageDailyLimit int
	AlphaVantageRateLimit  int
	CacheRefreshInterval   time.Duration
	AttomDataAPIKey        string
	AttomDataBaseURL       string
	// Feature flags for property valuation
	PropertyValuationEnabled bool
	AttomDataEnabled         bool
}

type MarketConfig struct {
	OpenTimeLocal  string
	CloseTimeLocal string
	Timezone       string
	WeekendTrades  bool
}

func Load() (*Config, error) {
	dbPort, _ := strconv.Atoi(getEnvOrDefault("DB_PORT", "5432"))
	rateLimitRPS, _ := strconv.Atoi(getEnvOrDefault("RATE_LIMIT_RPS", "100"))
	alphaVantageDailyLimit, _ := strconv.Atoi(getEnvOrDefault("ALPHA_VANTAGE_DAILY_LIMIT", "25"))
	alphaVantageRateLimit, _ := strconv.Atoi(getEnvOrDefault("ALPHA_VANTAGE_RATE_LIMIT", "5"))
	cacheRefreshMinutes, _ := strconv.Atoi(getEnvOrDefault("CACHE_REFRESH_MINUTES", "15"))
	
	// Parse feature flag boolean values (default to false for safety)
	propertyValuationEnabled, _ := strconv.ParseBool(getEnvOrDefault("PROPERTY_VALUATION_ENABLED", "false"))
	attomDataEnabled, _ := strconv.ParseBool(getEnvOrDefault("ATTOM_DATA_ENABLED", "false"))

	// Debug logging for API key
	apiKey := getEnvOrDefault("ALPHA_VANTAGE_API_KEY", "")
	if apiKey == "" {
		log.Println("WARNING: ALPHA_VANTAGE_API_KEY is not set - will use mock price provider")
	} else {
		log.Printf("INFO: Alpha Vantage API key loaded (length: %d characters)", len(apiKey))
	}

	return &Config{
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     dbPort,
			User:     getEnvOrDefault("DB_USER", "postgres"),
			Password: getEnvOrDefault("DB_PASSWORD", "password"),
			DBName:   getEnvOrDefault("DB_NAME", "networth_dashboard"),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
		},
		Server: ServerConfig{
			Port:            getEnvOrDefault("PORT", "8080"),
			ReadTimeout:     30 * time.Second,
			WriteTimeout:    30 * time.Second,
			ShutdownTimeout: 10 * time.Second,
			CORSEnabled:     true,
			CORSOrigins:     []string{"http://localhost:3000", "http://localhost:5173"},
		},
		Security: SecurityConfig{
			JWTSecret:       getEnvOrDefault("JWT_SECRET", "your-secret-key"),
			EncryptionKey:   getEnvOrDefault("ENCRYPTION_KEY", "your-encryption-key-32-chars-long"),
			CredentialKey:   getEnvOrDefault("CREDENTIAL_KEY", "your-credential-encryption-key-32-chars"),
			RateLimitEnable: true,
			RateLimitRPS:    rateLimitRPS,
		},
		API: ApiConfig{
			AlphaVantageAPIKey:       apiKey,
			AlphaVantageDailyLimit:   alphaVantageDailyLimit,
			AlphaVantageRateLimit:    alphaVantageRateLimit,
			CacheRefreshInterval:     time.Duration(cacheRefreshMinutes) * time.Minute,
			AttomDataAPIKey:          getEnvOrDefault("ATTOM_DATA_API_KEY", ""),
			AttomDataBaseURL:         getEnvOrDefault("ATTOM_DATA_BASE_URL", "https://api.gateway.attomdata.com/propertyapi/v1.0.0"),
			PropertyValuationEnabled: propertyValuationEnabled,
			AttomDataEnabled:         attomDataEnabled,
		},
		Market: MarketConfig{
			OpenTimeLocal:  getEnvOrDefault("MARKET_OPEN_LOCAL", "09:30"),  // 9:30 AM ET
			CloseTimeLocal: getEnvOrDefault("MARKET_CLOSE_LOCAL", "16:00"), // 4:00 PM ET
			Timezone:       getEnvOrDefault("MARKET_TIMEZONE", "America/New_York"),
			WeekendTrades:  false,
		},
	}, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
