# Cryptocurrency Holdings Document Processing Integration

## Overview

The AI document processing system now properly extracts and imports cryptocurrency holdings from financial documents into the dashboard's existing crypto holdings data structure.

## What Was Enhanced

### 1. Enhanced LLM Prompt (document_processor.go)

**Added comprehensive cryptocurrency extraction rules:**
- Look for crypto symbols (3-5 characters like BTC, ETH, ADA) or full names (Bitcoin, Ethereum)
- Extract token/coin balance (decimal numbers like 0.5 BTC, 1000 USDC)
- Extract current price per token/coin if shown
- Extract total USD value (balance × price)
- Include wallet type if mentioned (hardware, software, exchange, cold storage)
- Include crypto name or description
- Target common locations: crypto exchange statements, wallet summaries, DeFi protocols, portfolio tracking apps

**Updated JSON example to include crypto:**
```json
{
  "crypto": [
    {
      "symbol": "BTC",
      "balance": 0.5,
      "price": 50000.00,
      "value": 25000.00,
      "wallet_type": "hardware_wallet",
      "description": "Bitcoin"
    }
  ]
}
```

### 2. Comprehensive Crypto Validation (document_processor.go)

**Intelligent filtering and validation:**
- Require positive balance (balance > 0)
- Filter out obvious placeholder symbols (SYMBOL, CRYPTO, TOKEN, XXX, EXAMPLE, COIN)
- Validate symbol format (1-10 characters, longer than stocks to accommodate tokens like USDC)
- Allow crypto with 0 price/value if balance exists (will be updated with real prices later)
- Calculate value if missing but balance and price are present
- Normalize wallet type to lowercase
- Detailed logging for debugging

### 3. Enhanced Import Process (handlers.go)

**Improved importCrypto function:**
- Better logging for troubleshooting
- Updates existing crypto holdings by balance and price
- Creates new crypto holdings with proper data source tracking
- Maps wallet type information to notes field
- Handles purchase price tracking using current price

### 4. Frontend Support (Already Existed)

**The frontend already properly handles crypto holdings:**
- `ExtractedCrypto` type with symbol, balance, price, value, wallet_type, description
- DocumentViewer component displays crypto with symbol, balance, price, total value, and wallet type
- Approval workflow imports crypto into crypto_holdings table

## How It Works

### 1. Document Upload
- User uploads crypto exchange statement, wallet report, or portfolio summary
- Document processor extracts text/image content

### 2. AI Analysis
- Enhanced prompt specifically looks for cryptocurrency holdings sections
- Extracts: symbol, balance, price, value, wallet_type, description
- Validates and filters results to remove hallucinations

### 3. User Review
- DocumentViewer shows extracted crypto with:
  - Crypto symbol/name
  - Token/coin balance
  - Price per token
  - Total USD value
  - Wallet type (if available)
  - Description

### 4. Data Import
- On approval, crypto holdings are imported to `crypto_holdings` table
- Updates existing holdings or creates new ones
- Tracks data source as 'document_import'
- Includes wallet type information in notes

## Supported Document Types

### Crypto Exchange Statements
- Coinbase statements
- Binance reports
- Kraken account summaries
- Other exchange platforms

### Wallet Reports
- Hardware wallet summaries (Ledger, Trezor)
- Software wallet exports
- Mobile wallet screenshots

### Portfolio Tracking
- CoinTracker reports
- Blockfolio summaries
- Other crypto portfolio apps

### DeFi Protocols
- Compound statements
- Uniswap liquidity positions
- Staking rewards summaries

## Example Data Extracted
```json
{
  "crypto": [
    {
      "symbol": "BTC",
      "balance": 0.25,
      "price": 45000.00,
      "value": 11250.00,
      "wallet_type": "hardware_wallet",
      "description": "Bitcoin"
    },
    {
      "symbol": "ETH", 
      "balance": 5.0,
      "price": 3000.00,
      "value": 15000.00,
      "wallet_type": "exchange",
      "description": "Ethereum"
    },
    {
      "symbol": "USDC",
      "balance": 10000.0,
      "price": 1.00,
      "value": 10000.00,
      "wallet_type": "cold_storage",
      "description": "USD Coin"
    }
  ]
}
```

## Database Integration

Crypto holdings are imported into the existing `crypto_holdings` table:
- `crypto_symbol`: Crypto symbol (uppercase, e.g., BTC, ETH)
- `institution_name`: From document institution
- `balance_tokens`: Number of tokens/coins held
- `purchase_price_usd`: Set to current price from document
- `notes`: Includes wallet type and description
- `data_source`: Set to 'document_import'

## Validation and Error Handling

**Robust filtering system:**
- Invalid symbols are filtered out (placeholders, too long/short)
- Holdings with zero or negative balance are rejected
- Missing prices are set to 0 (can be updated later)
- Duplicate holdings update existing records
- Wallet type information is normalized and stored
- Detailed logging for troubleshooting

**Common crypto symbols supported:**
- Major cryptocurrencies: BTC, ETH, ADA, SOL, AVAX, MATIC
- Stablecoins: USDC, USDT, DAI, BUSD
- DeFi tokens: UNI, SUSHI, COMP, AAVE
- Meme coins: DOGE, SHIB (if found in documents)

## Testing

To test crypto holdings extraction:

1. Upload a crypto exchange statement or wallet report
2. Process with AI
3. Review extracted crypto holdings in DocumentViewer
4. Verify symbol, balance, price, value, and wallet type display
5. Approve to import into dashboard
6. Check Crypto Holdings page to see imported holdings

## Integration with Existing Features

- **Price Updates**: Imported crypto can be updated with real-time prices using existing crypto price service
- **Portfolio View**: Imported holdings appear alongside manually entered crypto
- **Filtering**: Can filter by institution or data source ('document_import')
- **Editing**: Users can edit imported crypto holdings like any other entry

## Security Considerations

- No private keys or sensitive wallet information is extracted
- Only public balance and price information is processed
- Wallet type is stored as metadata, not security credentials
- All document processing follows existing security protocols

The system is designed to be robust, avoid hallucinations, and integrate seamlessly with the existing crypto holdings infrastructure. Users can now easily import their cryptocurrency positions from various sources using AI-powered extraction.