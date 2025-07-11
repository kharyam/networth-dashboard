# Brokerage Account Stock Holdings Extraction Fixes

## Problem Resolved

**Issue**: When processing brokerage account PDFs showing stock holdings (e.g., IBM shares), the AI was incorrectly:
- Creating cash holdings with the total account value instead of individual stock positions
- Setting account type as unset instead of `taxable_brokerage`
- Missing the actual stock holdings (ticker + quantity)

## Root Cause

The AI was treating brokerage statements like bank statements, extracting total portfolio value as "cash balance" rather than recognizing individual stock positions. The prompt lacked specific guidance for investment/brokerage documents.

## Fixes Implemented

### 1. Enhanced LLM Prompt for Brokerage Accounts

**Added Critical Brokerage Rules:**
```
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
```

**Enhanced Stock Holdings Detection:**
- Added IBM as example ticker
- Emphasized that individual stock positions are MORE IMPORTANT than account totals
- Added pattern examples: "IBM 100 shares @ $150.00"
- Clarified priority: holdings extraction over account balance extraction

**Investment Statement Priority Logic:**
```
INVESTMENT STATEMENT PRIORITY:
- IF document has individual stock positions (ticker + shares): Extract as "holdings", skip total account value
- IF document only shows total account value without individual positions: Extract as account
- IF document shows both holdings AND separate cash balance: Extract both appropriately
```

### 2. Smart Account Validation Logic

**Prevents Total Portfolio Value Import as Cash:**
- For investment statements with holdings, compares account balance to total holdings value
- If account balance ≈ total holdings value (within 5% tolerance), skips the account import
- Recognizes account names suggesting portfolio totals ("Total", "Portfolio", "Market Value")
- Only imports legitimate cash balances, not portfolio summaries

**Example Logic:**
```go
// If account balance is close to total holdings value, skip it (it's likely the portfolio total)
if totalHoldingsValue > 0 && 
   account.Balance >= totalHoldingsValue*(1-tolerance) && 
   account.Balance <= totalHoldingsValue*(1+tolerance) {
    // Skip importing this as cash - it's the portfolio total
}
```

### 3. Improved Account Type Classification

**Enhanced Account Type Mapping:**
```go
typeMap := map[string]string{
    "investment":         "taxable_brokerage", // Map generic investment to taxable_brokerage
    "brokerage":          "taxable_brokerage",
    "brokerage_account":  "taxable_brokerage",
    "individual":         "taxable_brokerage", // Individual brokerage account
    "joint":              "taxable_brokerage", // Joint brokerage account
    "margin":             "taxable_brokerage", // Margin account
    "cash_account":       "taxable_brokerage", // Cash brokerage account
    "trading":            "taxable_brokerage", // Trading account
}
```

**Intelligent Pattern Matching:**
- Detects investment-related terms in account names
- Maps any account containing "brokerage", "investment", "trading", or "securities" to `taxable_brokerage`

## How It Now Works

### For Brokerage Statements with Stock Holdings:

1. **Document Analysis**: AI recognizes this as an `investment_statement`
2. **Stock Detection**: Finds individual positions (e.g., "IBM 100 shares")
3. **Holdings Extraction**: Extracts as stock holdings with ticker, quantity, price
4. **Account Logic**: Recognizes total account value as portfolio summary, not cash
5. **Validation**: Skips importing portfolio total as cash holding
6. **Result**: IBM holding imported to `stock_holdings` table, not `cash_holdings`

### For Mixed Documents:

- **Individual Holdings**: Extracted as stock holdings
- **Separate Cash Balance**: Only imported if explicitly labeled as cash
- **Portfolio Total**: Ignored to prevent duplication

## Testing Results

Now when processing a brokerage PDF with IBM shares:
- ✅ IBM stock holding created in `stock_holdings` table with correct ticker and quantity
- ✅ Account type properly set to `taxable_brokerage`
- ✅ Total portfolio value NOT imported as cash holding
- ✅ Only legitimate cash balances imported (if any)

## Benefits

1. **Accurate Holdings Import**: Stock positions imported correctly with ticker symbols and quantities
2. **No Duplicate Values**: Portfolio totals don't create incorrect cash holdings
3. **Proper Classification**: Investment accounts properly categorized
4. **Flexible Logic**: Handles both pure holdings and mixed holdings + cash scenarios
5. **Better Logging**: Clear logging helps debug extraction issues

## Supported Scenarios

### ✅ Now Works Correctly:
- Brokerage statements with individual stock listings
- Investment account summaries with holdings tables
- 401k statements with fund positions
- Mixed documents with both holdings and cash balances

### ⚠️ Edge Cases Handled:
- Portfolio total values labeled ambiguously
- Account names that don't clearly indicate type
- Missing price information (sets to 0 for later update)
- Multiple account types in single document

The fixes ensure that stock holdings are properly extracted and imported as securities rather than being misclassified as cash accounts.