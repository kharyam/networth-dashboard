# Export/Import System Implementation Plan

## Overview

This document provides a comprehensive implementation plan for adding export/import functionality to the networth-dashboard application. The system will allow users to export all their financial data and import it back, enabling data backup, migration, and sharing capabilities.

## Phase 1: Backend Export Implementation

### 1. Export Service Architecture

#### Create Export Service (`/backend/internal/services/export_service.go`)

```go
package services

import (
    "encoding/json"
    "database/sql"
    "fmt"
    "time"
    "path/filepath"
    "os"
)

type ExportService struct {
    db *sql.DB
}

func NewExportService(db *sql.DB) *ExportService {
    return &ExportService{db: db}
}

// ExportData exports data based on provided options
func (s *ExportService) ExportData(options ExportOptions) (*ExportJob, error) {
    // Create export job record
    job := &ExportJob{
        Status:    "pending",
        Format:    options.Format,
        Options:   marshalOptions(options),
        CreatedAt: time.Now(),
    }
    
    // Insert job into database
    jobID, err := s.createExportJob(job)
    if err != nil {
        return nil, err
    }
    job.ID = jobID
    
    // Start async export process
    go s.processExport(job, options)
    
    return job, nil
}

// processExport handles the actual data export process
func (s *ExportService) processExport(job *ExportJob, options ExportOptions) {
    s.updateJobStatus(job.ID, "processing")
    
    // Gather data from all tables
    exportData := &ExportData{}
    
    // Export accounts
    if s.shouldExportAssetType(options, "accounts") {
        accounts, err := s.exportAccounts()
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.Accounts = accounts
    }
    
    // Export stock holdings
    if s.shouldExportAssetType(options, "stocks") {
        stocks, err := s.exportStockHoldings(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.StockHoldings = stocks
    }
    
    // Export cash holdings
    if s.shouldExportAssetType(options, "cash") {
        cash, err := s.exportCashHoldings(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.CashHoldings = cash
    }
    
    // Export crypto holdings
    if s.shouldExportAssetType(options, "crypto") {
        crypto, err := s.exportCryptoHoldings(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.CryptoHoldings = crypto
    }
    
    // Export real estate
    if s.shouldExportAssetType(options, "real_estate") {
        realEstate, err := s.exportRealEstate(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.RealEstate = realEstate
    }
    
    // Export equity grants
    if s.shouldExportAssetType(options, "equity") {
        equity, err := s.exportEquityGrants(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.EquityGrants = equity
    }
    
    // Export other assets
    if s.shouldExportAssetType(options, "other") {
        other, err := s.exportOtherAssets(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.OtherAssets = other
    }
    
    // Export historical data if requested
    if options.IncludeHistory {
        history, err := s.exportHistoricalData(options)
        if err != nil {
            s.handleExportError(job.ID, err)
            return
        }
        exportData.HistoricalData = history
    }
    
    // Add metadata
    exportData.Metadata = ExportMetadata{
        Version:   "1.0",
        CreatedAt: time.Now(),
        Options:   options,
    }
    
    // Generate export file
    filePath, fileSize, err := s.generateExportFile(job.ID, exportData, options)
    if err != nil {
        s.handleExportError(job.ID, err)
        return
    }
    
    // Update job with completion details
    s.completeExportJob(job.ID, filePath, fileSize)
}

// Data export methods for each asset type
func (s *ExportService) exportAccounts() ([]Account, error) {
    query := `
        SELECT id, name, account_type, institution, account_number_last4, 
               is_active, created_at, updated_at
        FROM accounts
        ORDER BY institution, name
    `
    // Implementation details...
    return accounts, nil
}

func (s *ExportService) exportStockHoldings(options ExportOptions) ([]StockHolding, error) {
    query := `
        SELECT id, account_id, symbol, quantity, cost_basis, current_price,
               market_value, notes, created_at, updated_at
        FROM stock_holdings
    `
    if options.DateRange != nil {
        query += ` WHERE created_at >= $1 AND created_at <= $2`
    }
    query += ` ORDER BY symbol`
    // Implementation details...
    return holdings, nil
}

// Additional export methods for other asset types...
```

#### Data Models (`/backend/internal/models/export.go`)

```go
package models

import "time"

type ExportJob struct {
    ID          int        `json:"id" db:"id"`
    Status      string     `json:"status" db:"status"` // pending, processing, completed, failed
    Format      string     `json:"format" db:"format"` // json, csv
    Options     string     `json:"options" db:"options"` // JSON blob of export options
    FilePath    string     `json:"file_path" db:"file_path"`
    FileSize    int64      `json:"file_size" db:"file_size"`
    CreatedAt   time.Time  `json:"created_at" db:"created_at"`
    CompletedAt *time.Time `json:"completed_at" db:"completed_at"`
    ErrorMsg    string     `json:"error_msg" db:"error_msg"`
}

type ExportOptions struct {
    Format         string     `json:"format"`                    // json, csv
    AssetTypes     []string   `json:"asset_types,omitempty"`     // accounts, stocks, cash, crypto, real_estate, equity, other
    DateRange      *DateRange `json:"date_range,omitempty"`      // Optional date filtering
    IncludeHistory bool       `json:"include_history"`           // Include historical data
    Anonymize      bool       `json:"anonymize"`                 // Remove sensitive data
    Compress       bool       `json:"compress"`                  // Compress output file
}

type DateRange struct {
    StartDate time.Time `json:"start_date"`
    EndDate   time.Time `json:"end_date"`
}

type ExportData struct {
    Metadata        ExportMetadata    `json:"export_metadata"`
    Accounts        []Account         `json:"accounts,omitempty"`
    StockHoldings   []StockHolding    `json:"stock_holdings,omitempty"`
    CashHoldings    []CashHolding     `json:"cash_holdings,omitempty"`
    CryptoHoldings  []CryptoHolding   `json:"crypto_holdings,omitempty"`
    RealEstate      []RealEstate      `json:"real_estate,omitempty"`
    EquityGrants    []EquityGrant     `json:"equity_grants,omitempty"`
    OtherAssets     []OtherAsset      `json:"other_assets,omitempty"`
    HistoricalData  *HistoricalData   `json:"historical_data,omitempty"`
}

type ExportMetadata struct {
    Version   string        `json:"version"`
    CreatedAt time.Time     `json:"created_at"`
    Options   ExportOptions `json:"options"`
}

type HistoricalData struct {
    NetWorthSnapshots []NetWorthSnapshot `json:"net_worth_snapshots,omitempty"`
    StockPrices       []StockPrice       `json:"stock_prices,omitempty"`
    CryptoPrices      []CryptoPrice      `json:"crypto_prices,omitempty"`
    AccountBalances   []AccountBalance   `json:"account_balances,omitempty"`
}
```

#### Database Migration (`/backend/internal/database/migrations.go`)

Add to existing migrations:

```sql
-- Add export_jobs table
CREATE TABLE IF NOT EXISTS export_jobs (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    format VARCHAR(10) NOT NULL,
    options TEXT,
    file_path VARCHAR(500),
    file_size BIGINT,
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_export_jobs_status (status),
    INDEX idx_export_jobs_created_at (created_at)
);

-- Add import_jobs table for Phase 2
CREATE TABLE IF NOT EXISTS import_jobs (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    format VARCHAR(10) NOT NULL,
    options TEXT,
    records_total INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_errors INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    INDEX idx_import_jobs_status (status),
    INDEX idx_import_jobs_created_at (created_at)
);
```

### 2. Export API Endpoints

#### Add to `/backend/internal/api/handlers.go`

```go
// @Summary Get available export formats
// @Description List all supported export formats
// @Tags data-management
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Available export formats"
// @Router /export/formats [get]
func (s *Server) getExportFormats(c *gin.Context) {
    formats := []map[string]interface{}{
        {
            "format":      "json",
            "name":        "JSON",
            "description": "Complete data export in JSON format",
            "supports":    []string{"all_data", "compression", "anonymization"},
        },
        {
            "format":      "csv",
            "name":        "CSV Archive",
            "description": "Data export as ZIP archive containing CSV files",
            "supports":    []string{"all_data", "compression"},
        },
    }
    
    c.JSON(http.StatusOK, gin.H{
        "formats": formats,
    })
}

// @Summary Create data export
// @Description Initiate a data export with specified options
// @Tags data-management
// @Accept json
// @Produce json
// @Param request body ExportOptions true "Export options"
// @Success 202 {object} ExportJob "Export job created"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /export [post]
func (s *Server) createExport(c *gin.Context) {
    var options models.ExportOptions
    if err := c.ShouldBindJSON(&options); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "Invalid export options",
        })
        return
    }
    
    // Validate export options
    if err := s.validateExportOptions(options); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": fmt.Sprintf("Invalid options: %v", err),
        })
        return
    }
    
    // Create export job
    exportService := services.NewExportService(s.db)
    job, err := exportService.ExportData(options)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to create export job",
        })
        return
    }
    
    c.JSON(http.StatusAccepted, job)
}

// @Summary Get export status
// @Description Get the status of an export job
// @Tags data-management
// @Accept json
// @Produce json
// @Param id path int true "Export job ID"
// @Success 200 {object} ExportJob "Export job status"
// @Failure 404 {object} map[string]interface{} "Export job not found"
// @Router /export/{id}/status [get]
func (s *Server) getExportStatus(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "Invalid export job ID",
        })
        return
    }
    
    job, err := s.getExportJob(id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{
            "error": "Export job not found",
        })
        return
    }
    
    c.JSON(http.StatusOK, job)
}

// @Summary Download export file
// @Description Download the completed export file
// @Tags data-management
// @Accept json
// @Produce application/octet-stream
// @Param id path int true "Export job ID"
// @Success 200 {file} file "Export file"
// @Failure 404 {object} map[string]interface{} "Export not found or not ready"
// @Router /export/{id}/download [get]
func (s *Server) downloadExport(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "Invalid export job ID",
        })
        return
    }
    
    job, err := s.getExportJob(id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{
            "error": "Export job not found",
        })
        return
    }
    
    if job.Status != "completed" {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "Export not ready for download",
        })
        return
    }
    
    // Serve file
    filename := fmt.Sprintf("networth-export-%d.%s", job.ID, job.Format)
    if job.Format == "csv" {
        filename = fmt.Sprintf("networth-export-%d.zip", job.ID)
    }
    
    c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
    c.Header("Content-Type", "application/octet-stream")
    c.File(job.FilePath)
}

// @Summary Delete export job
// @Description Delete an export job and its associated file
// @Tags data-management
// @Accept json
// @Produce json
// @Param id path int true "Export job ID"
// @Success 200 {object} map[string]interface{} "Export deleted successfully"
// @Failure 404 {object} map[string]interface{} "Export job not found"
// @Router /export/{id} [delete]
func (s *Server) deleteExport(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "Invalid export job ID",
        })
        return
    }
    
    err = s.deleteExportJob(id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{
            "error": "Export job not found",
        })
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "message": "Export deleted successfully",
    })
}
```

#### Add routes to `/backend/internal/api/server.go`

```go
// Data management endpoints (add to existing route definitions)
api.GET("/export/formats", s.getExportFormats)
api.POST("/export", s.createExport)
api.GET("/export/:id/status", s.getExportStatus)
api.GET("/export/:id/download", s.downloadExport)
api.DELETE("/export/:id", s.deleteExport)
```

## Phase 2: Backend Import Implementation

### 1. Import Service Architecture

#### Create Import Service (`/backend/internal/services/import_service.go`)

```go
package services

import (
    "encoding/json"
    "database/sql"
    "fmt"
    "mime/multipart"
    "time"
)

type ImportService struct {
    db *sql.DB
}

func NewImportService(db *sql.DB) *ImportService {
    return &ImportService{db: db}
}

// ValidateImportFile validates an import file without importing
func (s *ImportService) ValidateImportFile(file multipart.File, header *multipart.FileHeader, options ImportOptions) (*ImportValidation, error) {
    validation := &ImportValidation{
        Filename: header.Filename,
        FileSize: header.Size,
        IsValid:  true,
        Errors:   []string{},
        Warnings: []string{},
    }
    
    // Detect file format
    format, err := s.detectFileFormat(file, header)
    if err != nil {
        validation.IsValid = false
        validation.Errors = append(validation.Errors, fmt.Sprintf("Unable to detect file format: %v", err))
        return validation, nil
    }
    validation.Format = format
    
    // Parse and validate content
    switch format {
    case "json":
        importData, err := s.parseJSONFile(file)
        if err != nil {
            validation.IsValid = false
            validation.Errors = append(validation.Errors, fmt.Sprintf("JSON parsing error: %v", err))
            return validation, nil
        }
        s.validateImportData(importData, validation)
    case "csv":
        // Handle CSV validation
        err := s.validateCSVArchive(file, validation)
        if err != nil {
            validation.IsValid = false
            validation.Errors = append(validation.Errors, fmt.Sprintf("CSV validation error: %v", err))
        }
    }
    
    return validation, nil
}

// ImportFile processes an import file
func (s *ImportService) ImportFile(file multipart.File, header *multipart.FileHeader, options ImportOptions) (*ImportJob, error) {
    // Create import job record
    job := &ImportJob{
        Status:    "pending",
        Filename:  header.Filename,
        FileSize:  header.Size,
        Options:   marshalImportOptions(options),
        CreatedAt: time.Now(),
    }
    
    // Insert job into database
    jobID, err := s.createImportJob(job)
    if err != nil {
        return nil, err
    }
    job.ID = jobID
    
    // Start async import process
    go s.processImport(job, file, options)
    
    return job, nil
}

// processImport handles the actual data import process
func (s *ImportService) processImport(job *ImportJob, file multipart.File, options ImportOptions) {
    s.updateImportJobStatus(job.ID, "processing")
    
    // Begin transaction for rollback capability
    tx, err := s.db.Begin()
    if err != nil {
        s.handleImportError(job.ID, err)
        return
    }
    
    defer func() {
        if err != nil {
            tx.Rollback()
            s.handleImportError(job.ID, err)
        } else {
            tx.Commit()
            s.completeImportJob(job.ID)
        }
    }()
    
    // Parse import file
    format, err := s.detectFileFormat(file, nil)
    if err != nil {
        return
    }
    
    var importData *ImportData
    switch format {
    case "json":
        importData, err = s.parseJSONFile(file)
        if err != nil {
            return
        }
    case "csv":
        importData, err = s.parseCSVArchive(file)
        if err != nil {
            return
        }
    }
    
    // Import data by category
    results := &ImportResults{}
    
    if importData.Accounts != nil {
        err = s.importAccounts(tx, importData.Accounts, options, results)
        if err != nil {
            return
        }
    }
    
    if importData.StockHoldings != nil {
        err = s.importStockHoldings(tx, importData.StockHoldings, options, results)
        if err != nil {
            return
        }
    }
    
    // Continue for other asset types...
    
    // Update job with results
    s.updateImportResults(job.ID, results)
}

// Conflict resolution strategies
func (s *ImportService) resolveConflict(existing interface{}, incoming interface{}, strategy string) (interface{}, bool) {
    switch strategy {
    case "skip":
        return existing, false // Don't import
    case "overwrite":
        return incoming, true // Replace existing
    case "merge":
        return s.mergeRecords(existing, incoming), true // Merge data
    default:
        return existing, false
    }
}
```

### 2. Import API Endpoints

#### Add to `/backend/internal/api/handlers.go`

```go
// @Summary Validate import file
// @Description Validate an import file without actually importing the data
// @Tags data-management
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Import file"
// @Param options formData string false "Import options (JSON)"
// @Success 200 {object} ImportValidation "Validation results"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Router /import/validate [post]
func (s *Server) validateImportFile(c *gin.Context) {
    // Parse multipart form
    file, header, err := c.Request.FormFile("file")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "No file provided",
        })
        return
    }
    defer file.Close()
    
    // Parse options
    var options models.ImportOptions
    if optionsStr := c.PostForm("options"); optionsStr != "" {
        if err := json.Unmarshal([]byte(optionsStr), &options); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid import options",
            })
            return
        }
    }
    
    // Validate file
    importService := services.NewImportService(s.db)
    validation, err := importService.ValidateImportFile(file, header, options)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to validate file",
        })
        return
    }
    
    c.JSON(http.StatusOK, validation)
}

// @Summary Import data file
// @Description Upload and import a data file
// @Tags data-management
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Import file"
// @Param options formData string false "Import options (JSON)"
// @Success 202 {object} ImportJob "Import job created"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Router /import [post]
func (s *Server) importFile(c *gin.Context) {
    // Parse multipart form
    file, header, err := c.Request.FormFile("file")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "error": "No file provided",
        })
        return
    }
    defer file.Close()
    
    // Parse options
    var options models.ImportOptions
    if optionsStr := c.PostForm("options"); optionsStr != "" {
        if err := json.Unmarshal([]byte(optionsStr), &options); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid import options",
            })
            return
        }
    }
    
    // Process import
    importService := services.NewImportService(s.db)
    job, err := importService.ImportFile(file, header, options)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to create import job",
        })
        return
    }
    
    c.JSON(http.StatusAccepted, job)
}

// Additional import endpoints...
```

## Phase 3: Frontend Implementation

### 1. Data Management Page

#### Create `/frontend/src/pages/DataManagement.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { DocumentArrowDownIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import ExportTab from '../components/DataManagement/ExportTab';
import ImportTab from '../components/DataManagement/ImportTab';
import HistoryTab from '../components/DataManagement/HistoryTab';

const DataManagement: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const tabs = [
    { name: 'Export', icon: DocumentArrowDownIcon, component: ExportTab },
    { name: 'Import', icon: DocumentArrowUpIcon, component: ImportTab },
    { name: 'History', icon: DocumentArrowDownIcon, component: HistoryTab },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
        <p className="mt-2 text-gray-600">
          Export your financial data for backup or import data from other sources
        </p>
      </div>

      <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          {tabs.map((tab, index) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                 ${selected
                   ? 'bg-white shadow'
                   : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                 }`
              }
            >
              <div className="flex items-center justify-center space-x-2">
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </div>
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-6">
          {tabs.map((tab, index) => (
            <Tab.Panel
              key={index}
              className="rounded-xl bg-white p-6 shadow-lg ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2"
            >
              <tab.component />
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default DataManagement;
```

### 2. Export Component

#### Create `/frontend/src/components/DataManagement/ExportTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { exportApi } from '../../services/api';
import { ExportOptions, ExportJob } from '../../types/export';

const ExportTab: React.FC = () => {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    assetTypes: [],
    includeHistory: false,
    anonymize: false,
    compress: true,
  });
  
  const [activeJobs, setActiveJobs] = useState<ExportJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExportJobs();
    const interval = setInterval(loadExportJobs, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadExportJobs = async () => {
    try {
      const response = await exportApi.getExportHistory();
      const jobs = response.data.exports || [];
      setActiveJobs(jobs.filter((job: ExportJob) => ['pending', 'processing'].includes(job.status)));
      setCompletedJobs(jobs.filter((job: ExportJob) => ['completed', 'failed'].includes(job.status)));
    } catch (error) {
      console.error('Failed to load export jobs:', error);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await exportApi.createExport(exportOptions);
      const newJob = response.data;
      setActiveJobs([...activeJobs, newJob]);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (jobId: number) => {
    try {
      const response = await exportApi.downloadExport(jobId);
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `networth-export-${jobId}.${exportOptions.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Configuration */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Configuration</h3>
        
        {/* Format Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <select
            value={exportOptions.format}
            onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="json">JSON (Complete data structure)</option>
            <option value="csv">CSV Archive (Spreadsheet compatible)</option>
          </select>
        </div>

        {/* Asset Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Asset Types (leave empty for all)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['accounts', 'stocks', 'cash', 'crypto', 'real_estate', 'equity', 'other'].map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.assetTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExportOptions({
                        ...exportOptions,
                        assetTypes: [...exportOptions.assetTypes, type]
                      });
                    } else {
                      setExportOptions({
                        ...exportOptions,
                        assetTypes: exportOptions.assetTypes.filter(t => t !== type)
                      });
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 capitalize">
                  {type.replace('_', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Options */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={exportOptions.includeHistory}
              onChange={(e) => setExportOptions({ ...exportOptions, includeHistory: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Include historical data</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={exportOptions.anonymize}
              onChange={(e) => setExportOptions({ ...exportOptions, anonymize: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Anonymize sensitive data</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={exportOptions.compress}
              onChange={(e) => setExportOptions({ ...exportOptions, compress: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Compress export file</span>
          </label>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Creating Export...' : 'Start Export'}
        </button>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Exports</h3>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Export #{job.id}</p>
                  <p className="text-sm text-gray-500">Status: {job.status}</p>
                </div>
                <div className="animate-spin h-5 w-5 text-yellow-600">
                  <ExclamationCircleIcon />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Jobs */}
      {completedJobs.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Exports</h3>
          <div className="space-y-2">
            {completedJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Export #{job.id}</p>
                  <p className="text-sm text-gray-500">
                    {job.format.toUpperCase()} • {formatFileSize(job.fileSize)} • 
                    {new Date(job.completedAt!).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <button
                    onClick={() => handleDownload(job.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ExportTab;
```

### 3. Import Component

#### Create `/frontend/src/components/DataManagement/ImportTab.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircleIcon, ExclamationTriangleIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { importApi } from '../../services/api';
import { ImportOptions, ImportValidation } from '../../types/import';

const ImportTab: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    conflictStrategy: 'skip',
    validateOnly: false,
    dryRun: false,
  });
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setValidation(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'application/zip': ['.zip'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const validateFile = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const response = await importApi.validateFile(selectedFile, importOptions);
      setValidation(response.data);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    try {
      const response = await importApi.importFile(selectedFile, importOptions);
      // Handle successful import initiation
      console.log('Import started:', response.data);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Import File</h3>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }`}
        >
          <input {...getInputProps()} />
          <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive
              ? 'Drop the file here...'
              : 'Drag and drop a file here, or click to select'
            }
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports JSON and CSV formats
          </p>
        </div>

        {selectedFile && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">
              {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
            </p>
          </div>
        )}
      </div>

      {/* Import Options */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Import Options</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conflict Resolution Strategy
            </label>
            <select
              value={importOptions.conflictStrategy}
              onChange={(e) => setImportOptions({ ...importOptions, conflictStrategy: e.target.value })}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="skip">Skip existing records</option>
              <option value="overwrite">Overwrite existing records</option>
              <option value="merge">Merge with existing records</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={importOptions.dryRun}
                onChange={(e) => setImportOptions({ ...importOptions, dryRun: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Dry run (preview changes only)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {validation && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Validation Results</h3>
          
          <div className={`p-4 rounded-lg ${validation.isValid ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className="flex items-center">
              {validation.isValid ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
              )}
              <h4 className={`font-medium ${validation.isValid ? 'text-green-800' : 'text-red-800'}`}>
                {validation.isValid ? 'File is valid and ready to import' : 'File has validation errors'}
              </h4>
            </div>
            
            {validation.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-800">Errors:</p>
                <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validation.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-yellow-800">Warnings:</p>
                <ul className="mt-1 list-disc list-inside text-sm text-yellow-700">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={validateFile}
          disabled={!selectedFile || loading}
          className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Validating...' : 'Validate File'}
        </button>
        
        <button
          onClick={handleImport}
          disabled={!selectedFile || !validation?.isValid || loading}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Start Import'}
        </button>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default ImportTab;
```

### 4. API Integration

#### Add to `/frontend/src/services/api.ts`

```typescript
// Export API
export const exportApi = {
  getFormats: (): Promise<{ data: { formats: ExportFormat[] } }> =>
    api.get('/export/formats'),
  
  createExport: (options: ExportOptions): Promise<{ data: ExportJob }> =>
    api.post('/export', options),
  
  getExportStatus: (id: number): Promise<{ data: ExportJob }> =>
    api.get(`/export/${id}/status`),
  
  downloadExport: (id: number): Promise<{ data: Blob }> =>
    api.get(`/export/${id}/download`, { responseType: 'blob' }),
  
  deleteExport: (id: number): Promise<{ data: { message: string } }> =>
    api.delete(`/export/${id}`),
  
  getExportHistory: (): Promise<{ data: { exports: ExportJob[] } }> =>
    api.get('/export/history'),
};

// Import API
export const importApi = {
  validateFile: (file: File, options: ImportOptions): Promise<{ data: ImportValidation }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));
    return api.post('/import/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  importFile: (file: File, options: ImportOptions): Promise<{ data: ImportJob }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));
    return api.post('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getImportStatus: (id: number): Promise<{ data: ImportJob }> =>
    api.get(`/import/${id}/status`),
  
  rollbackImport: (id: number): Promise<{ data: { message: string } }> =>
    api.post(`/import/${id}/rollback`),
  
  getImportHistory: (): Promise<{ data: { imports: ImportJob[] } }> =>
    api.get('/import/history'),
};
```

### 5. Navigation Integration

#### Add to `/frontend/src/components/Layout.tsx`

```typescript
// Add to navigation items
const navigation = [
  { name: 'Dashboard', href: '/', current: location.pathname === '/' },
  { name: 'Accounts', href: '/accounts', current: location.pathname === '/accounts' },
  { name: 'Stock Holdings', href: '/stocks', current: location.pathname === '/stocks' },
  { name: 'Cash Holdings', href: '/cash-holdings', current: location.pathname === '/cash-holdings' },
  { name: 'Crypto Holdings', href: '/crypto-holdings', current: location.pathname === '/crypto-holdings' },
  { name: 'Real Estate', href: '/real-estate', current: location.pathname === '/real-estate' },
  { name: 'Equity', href: '/equity', current: location.pathname === '/equity' },
  { name: 'Other Assets', href: '/other-assets', current: location.pathname === '/other-assets' },
  { name: 'Manual Entries', href: '/manual-entries', current: location.pathname === '/manual-entries' },
  { name: 'Data Management', href: '/data-management', current: location.pathname === '/data-management' }, // Add this line
];
```

#### Add route to `/frontend/src/App.tsx`

```typescript
import DataManagement from './pages/DataManagement';

// Add to routes
<Route path="/data-management" element={<DataManagement />} />
```

## Data Format Specifications

### JSON Export Format

```json
{
  "export_metadata": {
    "version": "1.0",
    "created_at": "2025-07-01T10:00:00Z",
    "options": {
      "format": "json",
      "asset_types": ["stocks", "cash"],
      "include_history": true,
      "anonymize": false,
      "compress": true
    }
  },
  "accounts": [
    {
      "id": 1,
      "name": "Investment Account",
      "account_type": "investment",
      "institution": "Fidelity",
      "account_number_last4": "1234",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-07-01T00:00:00Z"
    }
  ],
  "stock_holdings": [
    {
      "id": 1,
      "account_id": 1,
      "symbol": "AAPL",
      "quantity": 100,
      "cost_basis": 150.00,
      "current_price": 175.00,
      "market_value": 17500.00,
      "notes": "Long-term hold",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-07-01T00:00:00Z"
    }
  ],
  "cash_holdings": [
    {
      "id": 1,
      "account_id": 1,
      "institution_name": "Chase",
      "account_name": "Checking Account",
      "account_type": "checking",
      "current_balance": 5000.00,
      "interest_rate": 0.01,
      "monthly_contribution": 1000.00,
      "account_number_last4": "5678",
      "currency": "USD",
      "notes": "Primary checking account",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-07-01T00:00:00Z"
    }
  ],
  "historical_data": {
    "net_worth_snapshots": [
      {
        "id": 1,
        "date": "2025-07-01",
        "total_assets": 100000.00,
        "total_liabilities": 20000.00,
        "net_worth": 80000.00,
        "created_at": "2025-07-01T00:00:00Z"
      }
    ],
    "stock_prices": [
      {
        "symbol": "AAPL",
        "price": 175.00,
        "date": "2025-07-01",
        "created_at": "2025-07-01T00:00:00Z"
      }
    ]
  }
}
```

### CSV Export Format

When exporting as CSV, the system creates a ZIP archive containing:

- `accounts.csv` - All account data
- `stock_holdings.csv` - Stock positions
- `cash_holdings.csv` - Cash account data
- `crypto_holdings.csv` - Cryptocurrency positions
- `real_estate.csv` - Property data
- `equity_grants.csv` - Equity compensation
- `other_assets.csv` - Miscellaneous assets
- `net_worth_snapshots.csv` - Historical net worth (if included)
- `metadata.json` - Export metadata and options

## Security Considerations

### Data Protection
1. **Sensitive Data Handling**
   - Encrypted credentials are never exported
   - Account numbers are truncated (last 4 digits only)
   - Addresses can be anonymized if requested
   - File encryption option for export files

2. **Access Control**
   - All export/import operations require authentication
   - Rate limiting on export/import endpoints
   - File size limits to prevent abuse
   - Virus scanning for uploaded files

3. **Audit Trail**
   - All export/import operations are logged
   - Import operations create audit records
   - Rollback capability for imports

### File Security
1. **Upload Validation**
   - File type and format validation
   - Content structure validation
   - Malware scanning
   - Size limits (configurable)

2. **Storage Security**
   - Temporary storage for export files
   - Automatic cleanup after download
   - Secure file permissions
   - Optional encryption at rest

## Error Handling

### Backend Error Handling
1. **Validation Errors**
   - Comprehensive input validation
   - Detailed error messages
   - Graceful degradation

2. **Processing Errors**
   - Transaction rollback on failures
   - Partial import recovery
   - Detailed error logging

3. **Resource Management**
   - Memory-efficient large file processing
   - Connection pooling
   - Timeout handling

### Frontend Error Handling
1. **User Experience**
   - Clear error messages
   - Progress indicators
   - Retry mechanisms

2. **File Handling**
   - Upload progress tracking
   - File validation feedback
   - Recovery suggestions

## Performance Considerations

### Backend Optimization
1. **Large Data Handling**
   - Streaming for large exports
   - Paginated processing for imports
   - Background job processing

2. **Database Efficiency**
   - Optimized queries
   - Proper indexing
   - Connection pooling

### Frontend Optimization
1. **File Handling**
   - Chunked file uploads
   - Progress tracking
   - Client-side validation

2. **User Interface**
   - Lazy loading
   - Efficient re-rendering
   - Responsive design

## Testing Strategy

### Backend Testing
1. **Unit Tests**
   - Service layer testing
   - Data validation testing
   - Error handling testing

2. **Integration Tests**
   - End-to-end export/import flows
   - Database transaction testing
   - File handling testing

### Frontend Testing
1. **Component Tests**
   - UI component testing
   - Form validation testing
   - File upload testing

2. **Integration Tests**
   - API integration testing
   - User flow testing
   - Error scenario testing

## Deployment Considerations

### Environment Configuration
1. **File Storage**
   - Configurable storage locations
   - Cleanup job scheduling
   - Backup considerations

2. **Security Settings**
   - File size limits
   - Upload restrictions
   - Encryption settings

### Monitoring
1. **Performance Monitoring**
   - Export/import job metrics
   - File processing times
   - Error rates

2. **Security Monitoring**
   - Failed upload attempts
   - Suspicious activity
   - Access patterns

This implementation plan provides a comprehensive, secure, and user-friendly export/import system that integrates seamlessly with the existing networth-dashboard architecture while maintaining data integrity and security best practices.