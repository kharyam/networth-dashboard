package services

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ledongthuc/pdf"
)

// DocumentProcessor handles document upload, processing, and LLM integration
type DocumentProcessor struct {
	db         *sql.DB
	llmService *LLMService
	uploadDir  string
}

// DocumentProcessingJob represents a document processing job
type DocumentProcessingJob struct {
	ID               int       `json:"id"`
	Filename         string    `json:"filename"`
	FilePath         string    `json:"file_path"`
	FileType         string    `json:"file_type"`
	FileSize         int       `json:"file_size"`
	ProcessingStatus string    `json:"processing_status"`
	ExtractedData    *string   `json:"extracted_data,omitempty"`
	ErrorMessage     *string   `json:"error_message,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// FinancialDocumentData represents the standardized structure for extracted financial data
type FinancialDocumentData struct {
	DocumentType string                 `json:"document_type"`
	Institution  string                 `json:"institution"`
	Accounts     []ExtractedAccount     `json:"accounts"`
	Transactions []ExtractedTransaction `json:"transactions"`
	Holdings     []ExtractedHolding     `json:"holdings"`
	Crypto       []ExtractedCrypto      `json:"crypto"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// ExtractedAccount represents an account found in the document
type ExtractedAccount struct {
	AccountNumber string  `json:"account_number"`
	AccountType   string  `json:"account_type"`
	Balance       float64 `json:"balance"`
	Currency      string  `json:"currency"`
	Name          string  `json:"name,omitempty"`
}

// ExtractedTransaction represents a transaction found in the document
type ExtractedTransaction struct {
	Date        string  `json:"date"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	Category    string  `json:"category,omitempty"`
	Type        string  `json:"type,omitempty"`
}

// ExtractedHolding represents a stock/investment holding found in the document
type ExtractedHolding struct {
	Symbol      string  `json:"symbol"`
	Shares      float64 `json:"shares"`
	Price       float64 `json:"price"`
	Value       float64 `json:"value"`
	Description string  `json:"description,omitempty"`
}

// ExtractedCrypto represents a cryptocurrency holding found in the document
type ExtractedCrypto struct {
	Symbol      string  `json:"symbol"`
	Balance     float64 `json:"balance"`
	Price       float64 `json:"price"`
	Value       float64 `json:"value"`
	WalletType  string  `json:"wallet_type,omitempty"`
	Description string  `json:"description,omitempty"`
}

// ProcessingStatus constants
const (
	StatusUploaded   = "uploaded"
	StatusProcessing = "processing"
	StatusCompleted  = "completed"
	StatusFailed     = "failed"
	StatusApproved   = "approved"
	StatusRejected   = "rejected"
)

// NewDocumentProcessor creates a new document processor
func NewDocumentProcessor(db *sql.DB, llmService *LLMService, uploadDir string) *DocumentProcessor {
	return &DocumentProcessor{
		db:         db,
		llmService: llmService,
		uploadDir:  uploadDir,
	}
}

// UploadDocument handles file upload and creates a processing job
func (dp *DocumentProcessor) UploadDocument(ctx context.Context, file multipart.File, header *multipart.FileHeader) (*DocumentProcessingJob, error) {
	// Generate unique filename
	fileExt := filepath.Ext(header.Filename)
	uniqueID := uuid.New().String()
	filename := fmt.Sprintf("%s%s", uniqueID, fileExt)
	filePath := filepath.Join(dp.uploadDir, filename)

	// Create upload directory if it doesn't exist
	if err := os.MkdirAll(dp.uploadDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create upload directory: %w", err)
	}

	// Save file to disk
	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// Detect file type
	fileType := strings.ToLower(strings.TrimPrefix(fileExt, "."))
	if fileType == "" {
		fileType = "unknown"
	}

	// Create processing job in database
	job := &DocumentProcessingJob{
		Filename:         header.Filename,
		FilePath:         filePath,
		FileType:         fileType,
		FileSize:         int(header.Size),
		ProcessingStatus: StatusUploaded,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	query := `
		INSERT INTO document_processing_jobs (filename, file_path, file_type, file_size, processing_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id`

	err = dp.db.QueryRowContext(ctx, query, job.Filename, job.FilePath, job.FileType, job.FileSize, job.ProcessingStatus, job.CreatedAt, job.UpdatedAt).Scan(&job.ID)
	if err != nil {
		// Clean up file if database insert fails
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to create processing job: %w", err)
	}

	return job, nil
}

// ProcessDocument processes a document using the LLM service
func (dp *DocumentProcessor) ProcessDocument(ctx context.Context, jobID int) error {
	// Update status to processing
	if err := dp.updateJobStatus(ctx, jobID, StatusProcessing); err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}

	// Get job details
	job, err := dp.GetJob(ctx, jobID)
	if err != nil {
		return fmt.Errorf("failed to get job: %w", err)
	}

	// Process document based on type
	var extractedData *FinancialDocumentData

	switch job.FileType {
	case "pdf":
		extractedData, err = dp.processPDFDocument(ctx, job)
	case "csv":
		extractedData, err = dp.processCSVDocument(ctx, job)
	case "jpg", "jpeg", "png":
		extractedData, err = dp.processImageDocument(ctx, job)
	default:
		err = fmt.Errorf("unsupported file type: %s", job.FileType)
	}

	if err != nil {
		// Update job with error
		if updateErr := dp.updateJobWithError(ctx, jobID, err.Error()); updateErr != nil {
			return fmt.Errorf("failed to update job with error: %w", updateErr)
		}
		return fmt.Errorf("failed to process document: %w", err)
	}

	// Update job with results
	if err := dp.updateJobWithResults(ctx, jobID, extractedData); err != nil {
		return fmt.Errorf("failed to update job with results: %w", err)
	}

	return nil
}

// processPDFDocument processes a PDF document using text extraction and LLM analysis
func (dp *DocumentProcessor) processPDFDocument(ctx context.Context, job *DocumentProcessingJob) (*FinancialDocumentData, error) {
	// Extract text from PDF
	textContent, err := dp.extractTextFromPDF(job.FilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to extract text from PDF: %w", err)
	}

	// Create chat message with extracted text
	message := ChatMessage{
		Role:    "user",
		Content: fmt.Sprintf("%s\n\nDocument Content:\n%s", dp.getFinancialDocumentPrompt(), textContent),
	}

	// Send to LLM using regular chat completion (not vision)
	response, err := dp.llmService.ChatCompletion(ctx, []ChatMessage{message})
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response choices from LLM")
	}

	responseContent := response.Choices[0].Message.Content

	// Log the full response for debugging
	log.Printf("Full LLM response for PDF processing: %s", responseContent)

	// Strip markdown code blocks if present
	cleanedResponse := stripMarkdownCodeBlocks(responseContent)
	log.Printf("Cleaned response for parsing: %s", cleanedResponse)

	// Repair common JSON issues
	repairedResponse := dp.repairJSONResponse(cleanedResponse)
	if repairedResponse != cleanedResponse {
		log.Printf("JSON repair applied. Original length: %d, Repaired length: %d", len(cleanedResponse), len(repairedResponse))
	}

	// Parse JSON response
	var extractedData FinancialDocumentData
	if err := json.Unmarshal([]byte(repairedResponse), &extractedData); err != nil {
		log.Printf("Failed to parse LLM response as JSON. Response length: %d, Error: %v", len(repairedResponse), err)
		log.Printf("Response content (first 500 chars): %s", repairedResponse[:min(500, len(repairedResponse))])
		
		// Try to find the approximate location of the JSON error
		if syntaxErr, ok := err.(*json.SyntaxError); ok {
			offset := syntaxErr.Offset
			log.Printf("JSON syntax error at offset %d", offset)
			if offset > 0 && offset < int64(len(repairedResponse)) {
				start := max(0, int(offset)-50)
				end := min(len(repairedResponse), int(offset)+50)
				log.Printf("Context around error: %s", repairedResponse[start:end])
			}
		}
		
		return nil, fmt.Errorf("failed to parse LLM response as JSON: %w", err)
	}

	// Log the extracted data before validation
	log.Printf("Raw extracted data - Accounts: %d, Transactions: %d, Holdings: %d", 
		len(extractedData.Accounts), len(extractedData.Transactions), len(extractedData.Holdings))
	
	if len(extractedData.Holdings) > 0 {
		log.Printf("Holdings before validation:")
		for i, holding := range extractedData.Holdings {
			log.Printf("  [%d] Symbol: %s, Shares: %f, Price: %f, Value: %f, Description: %s", 
				i, holding.Symbol, holding.Shares, holding.Price, holding.Value, holding.Description)
		}
	}

	// Validate and transform the extracted data
	if err := dp.validateAndTransformFinancialData(&extractedData); err != nil {
		log.Printf("Failed to validate extracted data: %v", err)
		return nil, fmt.Errorf("failed to validate extracted data: %w", err)
	}

	// Log after validation
	if len(extractedData.Holdings) > 0 {
		log.Printf("Holdings after validation:")
		for i, holding := range extractedData.Holdings {
			log.Printf("  [%d] Symbol: %s, Shares: %f, Price: %f, Value: %f, Description: %s", 
				i, holding.Symbol, holding.Shares, holding.Price, holding.Value, holding.Description)
		}
	}

	return &extractedData, nil
}

// processCSVDocument processes a CSV document
func (dp *DocumentProcessor) processCSVDocument(ctx context.Context, job *DocumentProcessingJob) (*FinancialDocumentData, error) {
	// Read CSV file
	fileBytes, err := os.ReadFile(job.FilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Create chat message with CSV content
	message := ChatMessage{
		Role:    "user",
		Content: fmt.Sprintf("%s\n\nCSV Content:\n%s", dp.getFinancialDocumentPrompt(), string(fileBytes)),
	}

	// Send to LLM
	response, err := dp.llmService.ChatCompletion(ctx, []ChatMessage{message})
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response choices from LLM")
	}

	responseContent := response.Choices[0].Message.Content

	// Log the full response for debugging
	log.Printf("Full LLM response for CSV processing: %s", responseContent)

	// Strip markdown code blocks if present
	cleanedResponse := stripMarkdownCodeBlocks(responseContent)
	log.Printf("Cleaned response for parsing: %s", cleanedResponse)

	// Repair common JSON issues
	repairedResponse := dp.repairJSONResponse(cleanedResponse)
	if repairedResponse != cleanedResponse {
		log.Printf("JSON repair applied. Original length: %d, Repaired length: %d", len(cleanedResponse), len(repairedResponse))
	}

	// Parse JSON response
	var extractedData FinancialDocumentData
	if err := json.Unmarshal([]byte(repairedResponse), &extractedData); err != nil {
		log.Printf("Failed to parse LLM response as JSON. Response length: %d, Error: %v", len(repairedResponse), err)
		log.Printf("Response content (first 500 chars): %s", repairedResponse[:min(500, len(repairedResponse))])
		
		// Try to find the approximate location of the JSON error
		if syntaxErr, ok := err.(*json.SyntaxError); ok {
			offset := syntaxErr.Offset
			log.Printf("JSON syntax error at offset %d", offset)
			if offset > 0 && offset < int64(len(repairedResponse)) {
				start := max(0, int(offset)-50)
				end := min(len(repairedResponse), int(offset)+50)
				log.Printf("Context around error: %s", repairedResponse[start:end])
			}
		}
		
		return nil, fmt.Errorf("failed to parse LLM response as JSON: %w", err)
	}

	// Validate and transform the extracted data
	if err := dp.validateAndTransformFinancialData(&extractedData); err != nil {
		log.Printf("Failed to validate extracted data: %v", err)
		return nil, fmt.Errorf("failed to validate extracted data: %w", err)
	}

	return &extractedData, nil
}

// processImageDocument processes an image document using vision models
func (dp *DocumentProcessor) processImageDocument(ctx context.Context, job *DocumentProcessingJob) (*FinancialDocumentData, error) {
	// Read image file
	fileBytes, err := os.ReadFile(job.FilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Convert to base64
	base64Data := base64.StdEncoding.EncodeToString(fileBytes)
	dataURL := fmt.Sprintf("data:image/%s;base64,%s", job.FileType, base64Data)

	// Create vision message
	message := VisionMessage{
		Role: "user",
		Content: []struct {
			Type     string `json:"type"`
			Text     string `json:"text,omitempty"`
			ImageURL struct {
				URL string `json:"url"`
			} `json:"image_url,omitempty"`
		}{
			{
				Type: "text",
				Text: dp.getFinancialDocumentPrompt(),
			},
			{
				Type: "image_url",
				ImageURL: struct {
					URL string `json:"url"`
				}{
					URL: dataURL,
				},
			},
		},
	}

	// Send to LLM
	response, err := dp.llmService.VisionCompletion(ctx, []VisionMessage{message})
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM response: %w", err)
	}

	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no response choices from LLM")
	}

	responseContent := response.Choices[0].Message.Content

	// Log the full response for debugging
	log.Printf("Full LLM response for image processing: %s", responseContent)

	// Strip markdown code blocks if present
	cleanedResponse := stripMarkdownCodeBlocks(responseContent)
	log.Printf("Cleaned response for parsing: %s", cleanedResponse)

	// Repair common JSON issues
	repairedResponse := dp.repairJSONResponse(cleanedResponse)
	if repairedResponse != cleanedResponse {
		log.Printf("JSON repair applied. Original length: %d, Repaired length: %d", len(cleanedResponse), len(repairedResponse))
	}

	// Parse JSON response
	var extractedData FinancialDocumentData
	if err := json.Unmarshal([]byte(repairedResponse), &extractedData); err != nil {
		log.Printf("Failed to parse LLM response as JSON. Response length: %d, Error: %v", len(repairedResponse), err)
		log.Printf("Response content (first 500 chars): %s", repairedResponse[:min(500, len(repairedResponse))])
		
		// Try to find the approximate location of the JSON error
		if syntaxErr, ok := err.(*json.SyntaxError); ok {
			offset := syntaxErr.Offset
			log.Printf("JSON syntax error at offset %d", offset)
			if offset > 0 && offset < int64(len(repairedResponse)) {
				start := max(0, int(offset)-50)
				end := min(len(repairedResponse), int(offset)+50)
				log.Printf("Context around error: %s", repairedResponse[start:end])
			}
		}
		
		return nil, fmt.Errorf("failed to parse LLM response as JSON: %w", err)
	}

	// Validate and transform the extracted data
	if err := dp.validateAndTransformFinancialData(&extractedData); err != nil {
		log.Printf("Failed to validate extracted data: %v", err)
		return nil, fmt.Errorf("failed to validate extracted data: %w", err)
	}

	return &extractedData, nil
}

// GetJob retrieves a processing job by ID
func (dp *DocumentProcessor) GetJob(ctx context.Context, jobID int) (*DocumentProcessingJob, error) {
	query := `
		SELECT id, filename, file_path, file_type, file_size, processing_status, 
		       extracted_data, error_message, created_at, updated_at
		FROM document_processing_jobs
		WHERE id = $1`

	job := &DocumentProcessingJob{}
	err := dp.db.QueryRowContext(ctx, query, jobID).Scan(
		&job.ID, &job.Filename, &job.FilePath, &job.FileType, &job.FileSize,
		&job.ProcessingStatus, &job.ExtractedData,
		&job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("job not found")
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	return job, nil
}

// ListJobs lists all processing jobs
func (dp *DocumentProcessor) ListJobs(ctx context.Context, limit, offset int) ([]*DocumentProcessingJob, error) {
	query := `
		SELECT id, filename, file_path, file_type, file_size, processing_status, 
		       extracted_data, error_message, created_at, updated_at
		FROM document_processing_jobs
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2`

	rows, err := dp.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query jobs: %w", err)
	}
	defer rows.Close()

	var jobs []*DocumentProcessingJob
	for rows.Next() {
		job := &DocumentProcessingJob{}
		err := rows.Scan(
			&job.ID, &job.Filename, &job.FilePath, &job.FileType, &job.FileSize,
			&job.ProcessingStatus, &job.ExtractedData,
			&job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan job: %w", err)
		}
		jobs = append(jobs, job)
	}

	return jobs, nil
}

// updateJobStatus updates the processing status of a job
func (dp *DocumentProcessor) updateJobStatus(ctx context.Context, jobID int, status string) error {
	query := `
		UPDATE document_processing_jobs 
		SET processing_status = $1, updated_at = $2
		WHERE id = $3`

	_, err := dp.db.ExecContext(ctx, query, status, time.Now(), jobID)
	return err
}

// updateJobWithError updates a job with error information
func (dp *DocumentProcessor) updateJobWithError(ctx context.Context, jobID int, errorMessage string) error {
	query := `
		UPDATE document_processing_jobs 
		SET processing_status = $1, error_message = $2, updated_at = $3
		WHERE id = $4`

	_, err := dp.db.ExecContext(ctx, query, StatusFailed, errorMessage, time.Now(), jobID)
	return err
}

// updateJobWithResults updates a job with processing results
func (dp *DocumentProcessor) updateJobWithResults(ctx context.Context, jobID int, extractedData *FinancialDocumentData) error {
	log.Printf("Updating job %d with results. Accounts: %d, Transactions: %d, Holdings: %d", 
		jobID, len(extractedData.Accounts), len(extractedData.Transactions), len(extractedData.Holdings))
	
	extractedDataJSON, err := json.Marshal(extractedData)
	if err != nil {
		log.Printf("Failed to marshal extracted data for job %d: %v", jobID, err)
		return fmt.Errorf("failed to marshal extracted data: %w", err)
	}
	
	log.Printf("Marshaled JSON length: %d bytes for job %d", len(extractedDataJSON), jobID)
	log.Printf("JSON sample (first 200 chars): %s", string(extractedDataJSON)[:min(200, len(extractedDataJSON))])

	query := `
		UPDATE document_processing_jobs 
		SET processing_status = $1, extracted_data = $2, updated_at = $3
		WHERE id = $4`

	_, err = dp.db.ExecContext(ctx, query, StatusCompleted, string(extractedDataJSON), time.Now(), jobID)
	if err != nil {
		log.Printf("Database update failed for job %d: %v", jobID, err)
		log.Printf("Query parameters - Status: %s, JSON length: %d", 
			StatusCompleted, len(extractedDataJSON))
		return fmt.Errorf("failed to update database: %w", err)
	}
	
	log.Printf("Successfully updated job %d with extracted data", jobID)
	return nil
}

// getFinancialDocumentPrompt returns the prompt for financial document processing
func (dp *DocumentProcessor) getFinancialDocumentPrompt() string {
	return `You are a financial document parser. Analyze the provided financial document (bank statement, investment statement, brokerage statement, etc.) and extract the following information in JSON format:

{
  "document_type": "bank_statement|investment_statement|credit_card_statement|other",
  "institution": "Name of the financial institution",
  "accounts": [
    {
      "account_number": "Last 4 digits or identifier",
      "account_type": "checking|savings|investment|credit|401k|ira|taxable_brokerage",
      "balance": 0.00,
      "currency": "USD",
      "name": "Account name or description"
    }
  ],
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": 0.00,
      "description": "Transaction description",
      "category": "food|gas|shopping|transfer|dividend|other",
      "type": "debit|credit"
    }
  ],
  "holdings": [
    {
      "symbol": "AAPL",
      "shares": 100.0,
      "price": 150.00,
      "value": 15000.00,
      "description": "Apple Inc. Common Stock"
    }
    // ONLY include if stock holdings are explicitly listed in the document
    // Extract ALL stock positions, equity holdings, and securities shown
    // Look for: stock symbols, company names, share quantities, current prices, market values
    // LEAVE EMPTY ARRAY if no holdings exist: "holdings": []
  ],
  "crypto": [
    {
      "symbol": "BTC",
      "balance": 0.5,
      "price": 50000.00,
      "value": 25000.00,
      "wallet_type": "hardware_wallet",
      "description": "Bitcoin"
    }
    // ONLY include if cryptocurrency holdings are explicitly listed in the document
    // Extract ALL crypto positions and digital assets shown
    // Look for: crypto symbols/names, token balances, current prices, total values, wallet types
    // LEAVE EMPTY ARRAY if no crypto exists: "crypto": []
  ],
  "metadata": {
    "statement_date": "YYYY-MM-DD",
    "statement_period": "Statement period if available",
    "confidence_score": "High|Medium|Low"
  }
}

CRITICAL FORMATTING REQUIREMENTS:
1. RESPONSE MUST BE VALID JSON ONLY - no markdown code blocks, no extra text
2. Dates MUST be in YYYY-MM-DD format (e.g., "2024-06-15", not "06/15/2024")
3. Account types MUST be exactly one of: checking, savings, investment, credit, 401k, ira, taxable_brokerage
4. Transaction categories MUST be exactly one of: food, gas, shopping, transfer, dividend, other
5. ALL amounts must be POSITIVE numbers - NEVER use negative amounts
6. Currency should always be "USD" unless clearly stated otherwise
7. Transaction types: "debit" for money going out, "credit" for money coming in

AMOUNT AND TYPE RULES:
- NEVER use negative amounts (always positive numbers)
- Withdrawals, payments, purchases = positive amount + "type": "debit"
- Deposits, income, refunds = positive amount + "type": "credit"
- Example: $100 withdrawal = "amount": 100.00, "type": "debit"
- Example: $100 deposit = "amount": 100.00, "type": "credit"

ACCOUNT TYPE MAPPING:
- "condo", "condox", money market, CD = "savings"
- brokerage, investment account = "taxable_brokerage"
- 401k, 403b = "401k"
- Roth IRA, Traditional IRA = "ira"

CRITICAL BROKERAGE/INVESTMENT ACCOUNT RULES:
1. For INVESTMENT/BROKERAGE statements: PRIORITIZE individual stock holdings over account totals
2. If you see individual stocks (ticker + quantity), extract them as "holdings" - DO NOT create cash accounts
3. For brokerage accounts showing "Total Account Value" or "Portfolio Value": 
   - This represents the sum of all holdings, NOT a cash balance
   - DO NOT extract this as an account balance
   - Instead, extract the individual stock positions
4. Only extract brokerage cash balances if explicitly labeled as "Cash Balance", "Cash & Cash Equivalents", or "Uninvested Cash"
5. If the document shows both individual holdings AND a separate cash balance, extract both appropriately
6. Set document_type to "investment_statement" for brokerage/investment statements

STOCK HOLDINGS EXTRACTION RULES:
1. Look for stock symbols (3-5 character codes like AAPL, MSFT, TSLA, IBM)
2. Extract number of shares owned (whole numbers or decimals)
3. Extract current market price per share if shown
4. Extract total market value (shares × price)
5. Include company name or description if available
6. PRIORITY: Individual stock positions are MORE IMPORTANT than account totals
7. Common locations for holdings:
   - Portfolio summary sections
   - Holdings tables/lists
   - Asset allocation breakdowns
   - Investment account summaries
   - Brokerage statements
   - Individual security positions
8. Look for patterns like:
   - "IBM 100 shares @ $150.00"
   - "International Business Machines Corp. 100 $150.00 $15,000"
   - Ticker symbols in tables with quantities and values

CRYPTOCURRENCY EXTRACTION RULES:
1. Look for crypto symbols (3-5 characters like BTC, ETH, ADA) or full names (Bitcoin, Ethereum)
2. Extract token/coin balance (decimal numbers like 0.5 BTC, 1000 USDC)
3. Extract current price per token/coin if shown
4. Extract total USD value (balance × price)
5. Include wallet type if mentioned (hardware, software, exchange, cold storage)
6. Include crypto name or description
7. Common locations for crypto:
   - Crypto exchange statements (Coinbase, Binance, Kraken)
   - Wallet summaries
   - DeFi protocol statements
   - Portfolio tracking apps
   - Hardware wallet reports

EXTRACTION GUIDELINES:
1. Extract ONLY data that is explicitly present in the document
2. DO NOT INVENT, GUESS, or HALLUCINATE any information
3. If no holdings/stocks are listed, return empty array: "holdings": []
4. If no transactions exist, return empty array: "transactions": []
5. If no crypto exists, return empty array: "crypto": []
6. Use null for missing values, never make up data or partial words
7. Direct Deposits are always "credit" type (money coming in)
8. Card purchases, payments, withdrawals are always "debit" type (money going out)
9. Set confidence_score: "High" if very clear, "Medium" if mostly clear, "Low" if unclear
10. For stock holdings: ONLY extract if symbols and shares are clearly visible
11. For crypto: ONLY extract if symbols/names and balances are clearly visible
12. If price or value missing but shares/balance exist, set price/value to 0.0
13. IMPORTANT: For investment statements, if you find individual stock holdings, do NOT also create an account entry for the total portfolio value

INVESTMENT STATEMENT PRIORITY:
- IF document has individual stock positions (ticker + shares): Extract as "holdings", skip total account value
- IF document only shows total account value without individual positions: Extract as account
- IF document shows both holdings AND separate cash balance: Extract both appropriately

CRITICAL: EXTRACT REAL DATA FROM DOCUMENT - DO NOT USE EXAMPLES LIKE "AAPL" OR "BTC"

CRITICAL JSON FORMATTING:
- Return ONLY valid JSON - no markdown, no code blocks, no extra text
- Ensure ALL strings are properly quoted with double quotes
- Do not include trailing commas before closing brackets ], }
- Verify all brackets and braces are properly matched
- Each JSON property must have a colon after the key: "key": "value"
- End with a complete, valid JSON object
- Test that your JSON is valid before returning it`
}

// extractTextFromPDF extracts all text content from a PDF file
func (dp *DocumentProcessor) extractTextFromPDF(filePath string) (string, error) {
	// Open the PDF file
	file, reader, err := pdf.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open PDF: %w", err)
	}
	defer file.Close()

	var textContent strings.Builder
	totalPages := reader.NumPage()

	// Extract text from each page
	for pageNum := 1; pageNum <= totalPages; pageNum++ {
		page := reader.Page(pageNum)
		if page.V.IsNull() {
			continue
		}

		// Get text content from the page
		text, err := page.GetPlainText(nil)
		if err != nil {
			// Continue with other pages if one page fails
			continue
		}

		// Add page text to the total content
		if textContent.Len() > 0 {
			textContent.WriteString("\n\n--- Page ")
			textContent.WriteString(fmt.Sprintf("%d", pageNum))
			textContent.WriteString(" ---\n\n")
		}
		textContent.WriteString(strings.TrimSpace(text))
	}

	extractedText := textContent.String()

	// Check if we extracted any meaningful text
	if len(strings.TrimSpace(extractedText)) == 0 {
		return "", fmt.Errorf("no text content found in PDF - this might be a scanned document")
	}

	return extractedText, nil
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// stripMarkdownCodeBlocks removes markdown code block formatting from LLM responses
func stripMarkdownCodeBlocks(content string) string {
	// Remove leading and trailing whitespace
	content = strings.TrimSpace(content)
	
	// Remove markdown code block markers
	if strings.HasPrefix(content, "```json") {
		content = strings.TrimPrefix(content, "```json")
	} else if strings.HasPrefix(content, "```") {
		content = strings.TrimPrefix(content, "```")
	}
	
	if strings.HasSuffix(content, "```") {
		content = strings.TrimSuffix(content, "```")
	}
	
	// Remove any remaining leading/trailing whitespace
	return strings.TrimSpace(content)
}

// validateAndTransformFinancialData validates and transforms extracted financial data
func (dp *DocumentProcessor) validateAndTransformFinancialData(data *FinancialDocumentData) error {
	log.Printf("Validating and transforming financial data for %s from %s", data.DocumentType, data.Institution)
	
	// Validate and transform accounts
	validAccounts := make([]ExtractedAccount, 0)
	for i := range data.Accounts {
		account := &data.Accounts[i]
		
		// Normalize account type
		account.AccountType = dp.normalizeAccountType(account.AccountType)
		
		// Ensure currency is set
		if account.Currency == "" {
			account.Currency = "USD"
		}
		
		// For investment statements with holdings, skip importing total account values as cash
		if data.DocumentType == "investment_statement" && len(data.Holdings) > 0 {
			// Check if this looks like a total portfolio value rather than actual cash
			if account.AccountType == "taxable_brokerage" || account.AccountType == "investment" {
				// Calculate total holdings value
				totalHoldingsValue := 0.0
				for _, holding := range data.Holdings {
					totalHoldingsValue += holding.Value
				}
				
				// If account balance is close to total holdings value, skip it (it's likely the portfolio total)
				tolerance := 0.05 // 5% tolerance
				if totalHoldingsValue > 0 && 
				   account.Balance >= totalHoldingsValue*(1-tolerance) && 
				   account.Balance <= totalHoldingsValue*(1+tolerance) {
					log.Printf("Skipping account balance %f for %s - appears to be portfolio total (holdings total: %f)", 
						account.Balance, account.Name, totalHoldingsValue)
					continue
				}
				
				// Also skip if the account name suggests it's a total value
				accountNameLower := strings.ToLower(account.Name)
				if strings.Contains(accountNameLower, "total") || 
				   strings.Contains(accountNameLower, "portfolio") ||
				   strings.Contains(accountNameLower, "market value") {
					log.Printf("Skipping account '%s' - name suggests portfolio total, not cash balance", account.Name)
					continue
				}
			}
		}
		
		validAccounts = append(validAccounts, *account)
	}
	data.Accounts = validAccounts
	
	// Validate and transform transactions
	for i := range data.Transactions {
		transaction := &data.Transactions[i]
		
		// Convert date format
		if normalizedDate, err := dp.normalizeDateFormat(transaction.Date); err == nil {
			transaction.Date = normalizedDate
		} else {
			log.Printf("Warning: Invalid date format '%s', keeping original: %v", transaction.Date, err)
		}
		
		// Normalize category
		transaction.Category = dp.normalizeCategory(transaction.Category)
		
		// Fix amount and type consistency
		if transaction.Amount < 0 {
			// Convert negative amounts to positive and ensure correct type
			transaction.Amount = -transaction.Amount
			transaction.Type = "debit"
			log.Printf("Fixed negative amount: %f -> %f with type 'debit'", -transaction.Amount, transaction.Amount)
		}
		
		// Ensure type is set correctly based on transaction description
		if transaction.Type == "" {
			// Default to debit for most transactions unless clearly income
			transaction.Type = "debit"
		}
		
		// Fix obvious type mismatches based on description
		description := strings.ToLower(transaction.Description)
		if strings.Contains(description, "direct deposit") || 
		   strings.Contains(description, "interest paid") ||
		   strings.Contains(description, "deposit") ||
		   strings.Contains(description, "credit") {
			transaction.Type = "credit"
		}
	}
	
	// Validate and filter holdings
	validHoldings := make([]ExtractedHolding, 0)
	for _, holding := range data.Holdings {
		// Filter out invalid holdings but be more lenient
		if holding.Shares <= 0 {
			log.Printf("Filtering out holding with invalid shares: %s (shares: %f) - must have positive shares", 
				holding.Symbol, holding.Shares)
			continue
		}
		
		// Filter out obviously made-up symbols
		symbol := strings.ToUpper(strings.TrimSpace(holding.Symbol))
		if symbol == "" || symbol == "SYMBOL" || symbol == "STOCK" || symbol == "TICKER" || 
		   symbol == "XXX" || symbol == "EXAMPLE" {
			log.Printf("Filtering out placeholder holding symbol: %s", holding.Symbol)
			continue
		}
		
		// Validate symbol format (1-5 characters, alphanumeric)
		if len(symbol) < 1 || len(symbol) > 5 {
			log.Printf("Filtering out invalid symbol length: %s (length: %d)", symbol, len(symbol))
			continue
		}
		
		// Allow holdings with 0 price/value if shares exist (will be updated later with real prices)
		if holding.Price < 0 {
			log.Printf("Setting negative price to 0 for %s", symbol)
			holding.Price = 0
		}
		if holding.Value < 0 {
			log.Printf("Setting negative value to 0 for %s", symbol)
			holding.Value = 0
		}
		
		// If value is missing but we have shares and price, calculate it
		if holding.Value == 0 && holding.Shares > 0 && holding.Price > 0 {
			holding.Value = holding.Shares * holding.Price
			log.Printf("Calculated value for %s: %f shares * %f price = %f", symbol, holding.Shares, holding.Price, holding.Value)
		}
		
		// Ensure symbol is uppercase
		holding.Symbol = symbol
		validHoldings = append(validHoldings, holding)
		log.Printf("Valid holding: %s - %f shares @ %f = %f", symbol, holding.Shares, holding.Price, holding.Value)
	}
	data.Holdings = validHoldings
	
	// Validate and filter crypto holdings
	validCrypto := make([]ExtractedCrypto, 0)
	for _, crypto := range data.Crypto {
		// Filter out invalid crypto but be more lenient
		if crypto.Balance <= 0 {
			log.Printf("Filtering out crypto with invalid balance: %s (balance: %f) - must have positive balance", 
				crypto.Symbol, crypto.Balance)
			continue
		}
		
		// Filter out obviously made-up symbols
		symbol := strings.ToUpper(strings.TrimSpace(crypto.Symbol))
		if symbol == "" || symbol == "SYMBOL" || symbol == "CRYPTO" || symbol == "TOKEN" || 
		   symbol == "XXX" || symbol == "EXAMPLE" || symbol == "COIN" {
			log.Printf("Filtering out placeholder crypto symbol: %s", crypto.Symbol)
			continue
		}
		
		// Validate symbol format (1-10 characters for crypto, can be longer than stocks)
		if len(symbol) < 1 || len(symbol) > 10 {
			log.Printf("Filtering out invalid crypto symbol length: %s (length: %d)", symbol, len(symbol))
			continue
		}
		
		// Allow crypto with 0 price/value if balance exists (will be updated later with real prices)
		if crypto.Price < 0 {
			log.Printf("Setting negative price to 0 for %s", symbol)
			crypto.Price = 0
		}
		if crypto.Value < 0 {
			log.Printf("Setting negative value to 0 for %s", symbol)
			crypto.Value = 0
		}
		
		// If value is missing but we have balance and price, calculate it
		if crypto.Value == 0 && crypto.Balance > 0 && crypto.Price > 0 {
			crypto.Value = crypto.Balance * crypto.Price
			log.Printf("Calculated value for %s: %f balance * %f price = %f", symbol, crypto.Balance, crypto.Price, crypto.Value)
		}
		
		// Normalize wallet type
		if crypto.WalletType != "" {
			crypto.WalletType = strings.ToLower(strings.TrimSpace(crypto.WalletType))
		}
		
		// Ensure symbol is uppercase
		crypto.Symbol = symbol
		validCrypto = append(validCrypto, crypto)
		log.Printf("Valid crypto: %s - %f balance @ %f = %f (%s)", symbol, crypto.Balance, crypto.Price, crypto.Value, crypto.WalletType)
	}
	data.Crypto = validCrypto
	
	// Validate metadata
	if data.Metadata["statement_date"] != nil {
		if dateStr, ok := data.Metadata["statement_date"].(string); ok {
			if normalizedDate, err := dp.normalizeDateFormat(dateStr); err == nil {
				data.Metadata["statement_date"] = normalizedDate
			}
		}
	}
	
	// Ensure confidence score is set
	if data.Metadata["confidence_score"] == nil {
		data.Metadata["confidence_score"] = "Medium"
	}
	
	log.Printf("Data validation completed. Accounts: %d, Transactions: %d, Holdings: %d, Crypto: %d", 
		len(data.Accounts), len(data.Transactions), len(data.Holdings), len(data.Crypto))
	
	return nil
}

// normalizeAccountType maps account types to valid values
func (dp *DocumentProcessor) normalizeAccountType(accountType string) string {
	accountType = strings.ToLower(strings.TrimSpace(accountType))
	
	// Define mapping for common variations
	typeMap := map[string]string{
		"checking":           "checking",
		"savings":            "savings",
		"investment":         "taxable_brokerage", // Map generic investment to taxable_brokerage
		"credit":             "credit",
		"401k":               "401k",
		"ira":                "ira",
		"taxable_brokerage":  "taxable_brokerage",
		"brokerage":          "taxable_brokerage",
		"brokerage_account":  "taxable_brokerage",
		"individual":         "taxable_brokerage", // Individual brokerage account
		"joint":              "taxable_brokerage", // Joint brokerage account
		"margin":             "taxable_brokerage", // Margin account
		"cash_account":       "taxable_brokerage", // Cash brokerage account
		"trading":            "taxable_brokerage", // Trading account
		"condox":             "savings", // Map unknown type to savings
		"condo":              "savings",
		"escrow":             "savings",
		"money_market":       "savings",
		"cd":                 "savings",
		"certificate":        "savings",
		"401(k)":             "401k",
		"403(b)":             "401k",
		"roth_ira":           "ira",
		"traditional_ira":    "ira",
		"sep_ira":            "ira",
	}
	
	if mapped, exists := typeMap[accountType]; exists {
		return mapped
	}
	
	// Check for partial matches for investment-related terms
	if strings.Contains(accountType, "brokerage") || 
	   strings.Contains(accountType, "investment") ||
	   strings.Contains(accountType, "trading") ||
	   strings.Contains(accountType, "securities") {
		log.Printf("Account type '%s' contains investment-related terms, mapping to 'taxable_brokerage'", accountType)
		return "taxable_brokerage"
	}
	
	log.Printf("Unknown account type '%s', mapping to 'savings'", accountType)
	return "savings"
}

// normalizeCategory maps transaction categories to valid values
func (dp *DocumentProcessor) normalizeCategory(category string) string {
	category = strings.ToLower(strings.TrimSpace(category))
	
	// Define mapping for common variations
	categoryMap := map[string]string{
		"food":       "food",
		"gas":        "gas",
		"shopping":   "shopping",
		"transfer":   "transfer",
		"dividend":   "dividend",
		"other":      "other",
		"interest":   "dividend", // Map interest to dividend
		"salary":     "other",
		"payment":    "transfer",
		"deposit":    "transfer",
		"withdrawal": "transfer",
		"purchase":   "shopping",
		"grocery":    "food",
		"restaurant": "food",
		"dining":     "food",
		"fuel":       "gas",
		"gasoline":   "gas",
	}
	
	if mapped, exists := categoryMap[category]; exists {
		return mapped
	}
	
	log.Printf("Unknown category '%s', mapping to 'other'", category)
	return "other"
}

// normalizeDateFormat converts various date formats to YYYY-MM-DD
func (dp *DocumentProcessor) normalizeDateFormat(dateStr string) (string, error) {
	dateStr = strings.TrimSpace(dateStr)
	
	// Try different date formats
	formats := []string{
		"01/02/2006", // MM/DD/YYYY
		"1/2/2006",   // M/D/YYYY
		"01/2/2006",  // MM/D/YYYY
		"1/02/2006",  // M/DD/YYYY
		"2006-01-02", // YYYY-MM-DD (already correct)
		"01-02-2006", // MM-DD-YYYY
		"2006/01/02", // YYYY/MM/DD
	}
	
	for _, format := range formats {
		if parsedTime, err := time.Parse(format, dateStr); err == nil {
			return parsedTime.Format("2006-01-02"), nil
		}
	}
	
	// If we can't parse the date, try to extract year and set reasonable defaults
	yearRegex := regexp.MustCompile(`(\d{4})`)
	if matches := yearRegex.FindStringSubmatch(dateStr); len(matches) > 1 {
		year := matches[1]
		// If it's clearly a future year, adjust it
		currentYear := time.Now().Year()
		if year > fmt.Sprintf("%d", currentYear+1) {
			year = fmt.Sprintf("%d", currentYear)
		}
		return fmt.Sprintf("%s-01-01", year), nil
	}
	
	return "", fmt.Errorf("unable to parse date: %s", dateStr)
}

// repairJSONResponse attempts to fix common JSON formatting issues from LLM responses
func (dp *DocumentProcessor) repairJSONResponse(jsonStr string) string {
	// Remove any trailing whitespace
	jsonStr = strings.TrimSpace(jsonStr)
	
	// Only apply minimal fixes for common issues
	// Fix trailing commas before closing brackets/braces
	jsonStr = regexp.MustCompile(`,\s*([}\]])`).ReplaceAllString(jsonStr, "$1")
	
	// Fix missing commas between objects in arrays (be more conservative)
	// Only fix if it's clearly missing a comma between objects
	jsonStr = regexp.MustCompile(`}\s*\n\s*{\s*"`).ReplaceAllString(jsonStr, "},\n    {\"")
	
	return jsonStr
}
