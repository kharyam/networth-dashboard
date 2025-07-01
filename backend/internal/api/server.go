package api

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"

	"networth-dashboard/internal/config"
	"networth-dashboard/internal/credentials"
	"networth-dashboard/internal/handlers"
	"networth-dashboard/internal/plugins"
	"networth-dashboard/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

type Server struct {
	config                   *config.Config
	router                   *gin.Engine
	db                       *sql.DB
	pluginManager            *plugins.Manager
	credentialManager        *credentials.Manager
	cryptoService            *services.CryptoService
	priceService             *services.PriceService
	marketService            *services.MarketHoursService
	propertyValuationService *services.PropertyValuationService
	httpServer               *http.Server
}

func NewServer(cfg *config.Config, db *sql.DB, pluginManager *plugins.Manager) *Server {
	// Initialize credential manager
	credentialManager, err := credentials.NewManager(db, cfg.Security.CredentialKey)
	if err != nil {
		log.Fatal("Failed to initialize credential manager:", err)
	}

	// Initialize crypto service
	cryptoService := services.NewCryptoService(db)

	// Initialize market hours service
	marketService, err := services.NewMarketHoursService(&cfg.Market)
	if err != nil {
		log.Fatal("Failed to initialize market hours service:", err)
	}

	// Initialize price service with intelligent provider selection
	priceService := services.NewPriceServiceWithProviders(
		db,
		marketService,
		&cfg.API,
	)
	log.Printf("INFO: Price service initialized with provider: %s", priceService.GetProviderName())

	// Initialize property valuation service
	propertyValuationService := services.NewPropertyValuationService(&cfg.API)
	log.Printf("INFO: Property valuation service initialized with provider: %s", propertyValuationService.GetProviderName())

	server := &Server{
		config:                   cfg,
		db:                       db,
		pluginManager:            pluginManager,
		credentialManager:        credentialManager,
		cryptoService:            cryptoService,
		priceService:             priceService,
		marketService:            marketService,
		propertyValuationService: propertyValuationService,
	}

	server.setupRouter()
	return server
}

func (s *Server) setupRouter() {
	if s.config.Server.CORSEnabled {
		gin.SetMode(gin.ReleaseMode)
	}

	s.router = gin.Default()

	// CORS configuration
	if s.config.Server.CORSEnabled {
		config := cors.DefaultConfig()
		config.AllowOrigins = s.config.Server.CORSOrigins
		config.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
		config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
		s.router.Use(cors.New(config))
	}

	// Health check endpoint
	s.router.GET("/health", s.healthCheck)

	// Swagger documentation
	s.router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API routes
	api := s.router.Group("/api/v1")
	{
		// Net worth endpoints
		api.GET("/net-worth", s.getNetWorth)
		api.GET("/net-worth/history", s.getNetWorthHistory)

		// Account endpoints
		api.GET("/accounts", s.getAccounts)
		api.GET("/accounts/:id", s.getAccount)
		api.POST("/accounts", s.createAccount)
		api.PUT("/accounts/:id", s.updateAccount)
		api.DELETE("/accounts/:id", s.deleteAccount)

		// Balance endpoints
		api.GET("/balances", s.getBalances)
		api.GET("/accounts/:id/balances", s.getAccountBalances)

		// Stock holdings endpoints
		api.GET("/stocks", s.getStockHoldings)
		api.GET("/stocks/consolidated", s.getConsolidatedStocks)
		api.POST("/stocks", s.createStockHolding)
		api.PUT("/stocks/:id", s.updateStockHolding)
		api.DELETE("/stocks/:id", s.deleteStockHolding)

		// Equity compensation endpoints
		api.GET("/equity", s.getEquityGrants)
		api.GET("/equity/:id/vesting", s.getVestingSchedule)
		api.POST("/equity", s.createEquityGrant)
		api.PUT("/equity/:id", s.updateEquityGrant)
		api.DELETE("/equity/:id", s.deleteEquityGrant)

		// Real estate endpoints
		api.GET("/real-estate", s.getRealEstate)
		api.POST("/real-estate", s.createRealEstate)
		api.PUT("/real-estate/:id", s.updateRealEstate)
		api.DELETE("/real-estate/:id", s.deleteRealEstate)

		// Cash holdings endpoints
		api.GET("/cash-holdings", s.getCashHoldings)

		// Crypto holdings endpoints
		api.GET("/crypto-holdings", s.getCryptoHoldings)
		api.POST("/crypto-holdings", s.createCryptoHolding)
		api.PUT("/crypto-holdings/:id", s.updateCryptoHolding)
		api.DELETE("/crypto-holdings/:id", s.deleteCryptoHolding)

		// Other assets endpoints
		api.GET("/other-assets", s.getOtherAssets)
		api.POST("/other-assets", s.createOtherAsset)
		api.PUT("/other-assets/:id", s.updateOtherAsset)
		api.DELETE("/other-assets/:id", s.deleteOtherAsset)

		// Asset categories endpoints
		api.GET("/asset-categories", s.getAssetCategories)
		api.POST("/asset-categories", s.createAssetCategory)
		api.PUT("/asset-categories/:id", s.updateAssetCategory)
		api.DELETE("/asset-categories/:id", s.deleteAssetCategory)
		api.GET("/asset-categories/:id/schema", s.getAssetCategorySchema)

		// Crypto price endpoints
		api.GET("/crypto/prices/:symbol", s.getCryptoPrice)
		api.GET("/crypto/prices/history", s.getCryptoPriceHistory)
		api.POST("/crypto/prices/refresh", s.refreshCryptoPrices)
		api.POST("/crypto/prices/refresh/:symbol", s.refreshCryptoPrice)

		// Plugin management endpoints
		api.GET("/plugins", s.getPlugins)
		api.GET("/plugins/:name/schema", s.getPluginSchema)
		api.GET("/plugins/:name/schema/:category_id", s.getPluginSchemaForCategory)
		api.POST("/plugins/:name/manual-entry", s.processManualEntry)
		api.POST("/plugins/refresh", s.refreshPluginData)
		api.GET("/plugins/health", s.getPluginHealth)

		// Manual entry endpoints
		api.GET("/manual-entries", s.getManualEntries)
		api.POST("/manual-entries", s.createManualEntry)
		api.PUT("/manual-entries/:id", s.updateManualEntry)
		api.DELETE("/manual-entries/:id", s.deleteManualEntry)
		api.GET("/manual-entries/schemas", s.getManualEntrySchemas)

		// Price management endpoints
		api.GET("/prices/refresh", s.refreshPrices)
		api.POST("/prices/refresh", s.refreshPrices)
		api.POST("/prices/refresh/:symbol", s.refreshSymbolPrice)
		api.GET("/prices/status", s.getPricesStatus)
		
		// Market status endpoints
		api.GET("/market/status", s.getMarketStatus)

		// Property valuation endpoints
		api.GET("/property-valuation", s.getPropertyValuation)
		api.POST("/property-valuation/refresh", s.refreshPropertyValuation)
		api.GET("/property-valuation/providers", s.getPropertyValuationProviders)

		// Credential management endpoints
		credentialHandler := handlers.NewCredentialHandler(s.credentialManager)
		handlers.RegisterCredentialRoutes(api, credentialHandler)
		
		// OpenAPI spec download
		// @Summary Download OpenAPI specification
		// @Description Download the complete OpenAPI specification in JSON format
		// @Tags system
		// @Produce json
		// @Success 200 {object} object "OpenAPI specification"
		// @Router /swagger/spec [get]
		api.GET("/swagger/spec", func(c *gin.Context) {
			c.Header("Content-Type", "application/json")
			c.File("docs/swagger.json")
		})
	}
}

func (s *Server) Start(addr string) error {
	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  s.config.Server.ReadTimeout,
		WriteTimeout: s.config.Server.WriteTimeout,
	}

	log.Printf("Server starting on %s", addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	log.Println("Server shutting down...")
	return s.httpServer.Shutdown(ctx)
}

// Health check endpoint
// @Summary Health check
// @Description Get comprehensive system health status including database, plugins, and services
// @Tags system
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "System health status"
// @Failure 503 {object} map[string]interface{} "Service unavailable"
// @Router /health [get]
func (s *Server) healthCheck(c *gin.Context) {
	// Check database connection
	dbStatus := "connected"
	if err := s.db.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":   "unhealthy",
			"database": "disconnected",
			"error":    err.Error(),
		})
		return
	}

	// Get plugin health status
	pluginList := s.pluginManager.ListPlugins()
	pluginCount := len(pluginList)

	// Get price service status
	priceStatus := s.getPriceStatus()
	
	// Get market status
	marketOpen := s.marketService.IsMarketOpen()
	
	// Get crypto service status
	var cryptoSymbolCount int
	query := "SELECT COUNT(DISTINCT crypto_symbol) FROM crypto_holdings"
	s.db.QueryRow(query).Scan(&cryptoSymbolCount)

	// Get property valuation service status
	propertyProvider := s.propertyValuationService.GetProviderName()

	c.JSON(http.StatusOK, gin.H{
		"status":     "healthy",
		"timestamp":  time.Now().Format(time.RFC3339),
		"database":   dbStatus,
		"plugins": gin.H{
			"total_count": pluginCount,
			"available":   pluginList,
		},
		"price_service": gin.H{
			"provider":            priceStatus.ProviderName,
			"last_updated":        priceStatus.LastUpdated,
			"stale_prices":        priceStatus.StaleCount,
			"total_symbols":       priceStatus.TotalCount,
			"cache_age_minutes":   priceStatus.CacheAgeMinutes,
			"force_refresh_needed": priceStatus.ForceRefreshNeeded,
		},
		"market_status": gin.H{
			"is_open": marketOpen,
		},
		"crypto_service": gin.H{
			"symbols_tracked": cryptoSymbolCount,
		},
		"property_service": gin.H{
			"provider": propertyProvider,
		},
		"version": "1.0",
	})
}