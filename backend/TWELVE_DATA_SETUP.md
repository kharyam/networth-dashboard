# Twelve Data API Setup Guide

## Overview

Twelve Data is now the **primary price provider** for the NetWorth Dashboard, offering significant advantages over Alpha Vantage's free tier:

| Feature | Twelve Data (Free) | Alpha Vantage (Free) |
|---------|-------------------|---------------------|
| Daily API Calls | 800 | 25 |
| Data Freshness | Real-time (15-min delay) | End-of-day only |
| Rate Limit | 8 calls/minute | 5 calls/minute |
| Data Quality | Current trading day | Last trading day |

## Getting Your API Key

1. **Sign Up**: Visit [https://twelvedata.com/](https://twelvedata.com/)
2. **Create Account**: Free registration with email
3. **Get API Key**: Available immediately in your dashboard
4. **Free Tier**: Includes 800 API calls per day

## Configuration

### 1. Add to Environment Variables

```bash
# Add to your .env file or export directly
export TWELVE_DATA_API_KEY="your_api_key_here"

# Optional: Customize limits (defaults shown)
export TWELVE_DATA_DAILY_LIMIT=800
export TWELVE_DATA_RATE_LIMIT=8
export PRIMARY_PRICE_PROVIDER=twelvedata
```

### 2. Keep Alpha Vantage as Fallback (Optional)

```bash
# Keep your existing Alpha Vantage key as backup
export ALPHA_VANTAGE_API_KEY="your_alpha_vantage_key"
export FALLBACK_PRICE_PROVIDER=alphavantage
```

## Testing the Setup

1. **Start the backend** with new environment variables
2. **Check logs** for provider initialization:
   ```
   INFO: Twelve Data API key loaded (length: 32 characters)
   INFO: Primary price provider: twelvedata, Fallback: alphavantage
   INFO: Attempting to initialize Twelve Data as primary provider
   INFO: Testing Twelve Data connection...
   INFO: Twelve Data provider test successful - AAPL price: $201.45
   INFO: Price service initialized with provider: Twelve Data
   ```

3. **Test price refresh** - should now show:
   ```
   INFO: Making Twelve Data API call for AAPL (force: false)
   INFO: Twelve Data price for AAPL is 5.2 minutes old (datetime: 2025-06-30 15:45:00)
   DEBUG: Successfully parsed price 201.45 for AAPL from Twelve Data
   ```

## Expected Improvements

With Twelve Data, you should see:

✅ **Current day prices** instead of June 27th data  
✅ **15-minute delayed real-time** instead of end-of-day  
✅ **32x more API calls** per day (800 vs 25)  
✅ **Better rate limits** for faster refreshes  
✅ **Automatic fallback** to Alpha Vantage if needed  

## API Response Example

Twelve Data provides much fresher data:

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc",
  "exchange": "NASDAQ",
  "currency": "USD",
  "datetime": "2025-06-30 15:45:00",  // Current trading day!
  "timestamp": 1719764700,
  "open": "201.25",
  "high": "202.15",
  "low": "200.85",
  "close": "201.45",                  // Real-time price
  "volume": "45123456",
  "is_market_open": true
}
```

## Troubleshooting

### Provider Falls Back to Alpha Vantage
- Check that `TWELVE_DATA_API_KEY` is correctly set
- Verify API key is valid at [twelve data dashboard](https://twelvedata.com/account)
- Check logs for connection test results

### Rate Limit Exceeded
- Free tier: 800 calls/day, 8 calls/minute
- Monitor usage in logs: `DEBUG: Twelve Data rate check: 3 < 8 = true`
- Consider spreading out refresh requests

### Still Getting Stale Data
- Twelve Data provides 15-minute delayed data during market hours
- Outside market hours, will show last close price
- Much fresher than Alpha Vantage's end-of-day limitation

## Migration Notes

- **Existing Alpha Vantage users**: Keep your existing key as fallback
- **No database changes needed**: Same cache tables and structure
- **Automatic switching**: System will try Twelve Data first, fall back to Alpha Vantage
- **Source tracking**: New prices tagged as `source: 'twelvedata'` in database

The system is now configured to provide much more current stock price data!