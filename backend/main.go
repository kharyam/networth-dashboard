package main

import (
	"log"
	"os"

	"networth-dashboard/internal/api"
	"networth-dashboard/internal/config"
	"networth-dashboard/internal/database"
	"networth-dashboard/internal/plugins"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Initialize database
	db, err := database.Initialize(cfg.Database)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize plugin manager
	pluginManager := plugins.NewManager(db.DB)

	// Initialize API server
	server := api.NewServer(cfg, db.DB, pluginManager)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on port %s", port)
	if err := server.Start(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}