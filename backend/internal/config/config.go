package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Database DatabaseConfig
	Server   ServerConfig
	Security SecurityConfig
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
	JWTSecret         string
	EncryptionKey     string
	CredentialKey     string
	RateLimitEnable   bool
	RateLimitRPS      int
}

func Load() (*Config, error) {
	dbPort, _ := strconv.Atoi(getEnvOrDefault("DB_PORT", "5432"))
	rateLimitRPS, _ := strconv.Atoi(getEnvOrDefault("RATE_LIMIT_RPS", "100"))
	
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
	}, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}