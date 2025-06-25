package api

import (
	"context"
	"database/sql"
	"log"
	"net/http"

	"networth-dashboard/internal/config"
	"networth-dashboard/internal/credentials"
	"networth-dashboard/internal/handlers"
	"networth-dashboard/internal/plugins"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type Server struct {
	config            *config.Config
	router            *gin.Engine
	db                *sql.DB
	pluginManager     *plugins.Manager
	credentialManager *credentials.Manager
	httpServer        *http.Server
}

func NewServer(cfg *config.Config, db *sql.DB, pluginManager *plugins.Manager) *Server {
	// Initialize credential manager
	credentialManager, err := credentials.NewManager(db, cfg.Security.CredentialKey)
	if err != nil {
		log.Fatal("Failed to initialize credential manager:", err)
	}

	server := &Server{
		config:            cfg,
		db:                db,
		pluginManager:     pluginManager,
		credentialManager: credentialManager,
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

		// Plugin management endpoints
		api.GET("/plugins", s.getPlugins)
		api.GET("/plugins/:name/schema", s.getPluginSchema)
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
		api.POST("/prices/refresh", s.refreshPrices)
		api.POST("/prices/refresh/:symbol", s.refreshSymbolPrice)
		api.GET("/prices/status", s.getPricesStatus)

		// Credential management endpoints
		credentialHandler := handlers.NewCredentialHandler(s.credentialManager)
		handlers.RegisterCredentialRoutes(api, credentialHandler)
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
func (s *Server) healthCheck(c *gin.Context) {
	// Check database connection
	if err := s.db.Ping(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":   "unhealthy",
			"database": "disconnected",
			"error":    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "healthy",
		"database": "connected",
		"plugins":  len(s.pluginManager.ListPlugins()),
	})
}