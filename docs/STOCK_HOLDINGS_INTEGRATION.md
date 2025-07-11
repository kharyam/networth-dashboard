# Stock Holdings Document Processing Integration

## Overview

The AI document processing system now properly extracts and imports stock holdings from financial documents into the dashboard's existing stock holdings data structure.

## What Was Enhanced

### 1. Enhanced LLM Prompt (document_processor.go)

**Added comprehensive stock holdings extraction rules:**
- Look for stock symbols (3-5 character codes like AAPL, MSFT, TSLA)
- Extract number of shares owned (whole numbers or decimals)
- Extract current market price per share if shown
- Extract total market value (shares × price)
- Include company name or description if available
- Target common locations: portfolio summaries, holdings tables, asset allocation breakdowns

**Improved extraction guidelines:**
- Only extract if symbols and shares are clearly visible
- If price or value missing but shares exist, set price/value to 0.0
- Extract real holdings from document - do not use examples

### 2. Better Holdings Validation (document_processor.go)

**More intelligent filtering:**
- Require positive share count (shares > 0)
- Filter out obvious placeholder symbols (SYMBOL, STOCK, TICKER, XXX, EXAMPLE)
- Validate symbol format (1-5 characters)
- Allow holdings with 0 price/value if shares exist (will be updated with real prices later)
- Calculate value if missing but shares and price are present
- Better logging for debugging

### 3. Enhanced Import Process (handlers.go)

**Improved importHolding function:**
- Better logging for troubleshooting
- Handles existing holdings by updating shares and price
- Creates new holdings with proper data source tracking
- Maps to existing stock_holdings table structure

### 4. Frontend Support (Already Existed)

**The frontend already properly handles stock holdings:**
- `ExtractedHolding` type with symbol, shares, price, value, description
- DocumentViewer component displays holdings with symbol, shares, price, and total value
- Approval workflow imports holdings into stock_holdings table

## How It Works

### 1. Document Upload
- User uploads financial statement (PDF, CSV, Excel, or image)
- Document processor extracts text/image content

### 2. AI Analysis
- Enhanced prompt specifically looks for stock holdings sections
- Extracts: symbol, shares, price, value, description
- Validates and filters results to remove hallucinations

### 3. User Review
- DocumentViewer shows extracted holdings with:
  - Stock symbol
  - Number of shares
  - Price per share
  - Total value
  - Company description

### 4. Data Import
- On approval, holdings are imported to `stock_holdings` table
- Updates existing holdings or creates new ones
- Tracks data source as 'document_import'

## Supported Document Types

### Investment Statements
- Brokerage account statements
- Portfolio summaries
- Holdings reports
- 401k/IRA statements

### Example Data Extracted
```json
{
  "holdings": [
    {
      "symbol": "AAPL",
      "shares": 100.0,
      "price": 150.00,
      "value": 15000.00,
      "description": "Apple Inc. Common Stock"
    },
    {
      "symbol": "MSFT", 
      "shares": 50.0,
      "price": 300.00,
      "value": 15000.00,
      "description": "Microsoft Corporation"
    }
  ]
}
```

## Database Integration

Holdings are imported into the existing `stock_holdings` table:
- `symbol`: Stock ticker symbol (uppercase)
- `company_name`: From description field
- `shares_owned`: Number of shares
- `current_price`: Price per share
- `institution_name`: From document institution
- `data_source`: Set to 'document_import'
- `is_vested_equity`: Set to false (distinguishes from equity compensation)

## Error Handling

- Invalid symbols are filtered out
- Holdings with zero or negative shares are rejected
- Missing prices are set to 0 (can be updated later)
- Duplicate holdings update existing records
- Detailed logging for troubleshooting

## Testing

To test stock holdings extraction:

1. Upload a brokerage statement PDF/image with visible holdings
2. Process with AI
3. Review extracted holdings in DocumentViewer
4. Approve to import into dashboard
5. Check Stocks page to see imported holdings

The system is designed to be robust and handle various document formats while avoiding hallucinations or fake data extraction.

## Related Features

This stock holdings integration works alongside the **Cryptocurrency Holdings Integration** - documents can contain both stock and crypto holdings, and both will be extracted and imported simultaneously. See `CRYPTO_HOLDINGS_INTEGRATION.md` for details on crypto extraction capabilities.