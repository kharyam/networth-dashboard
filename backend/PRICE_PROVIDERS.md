# Stock Price Provider Options

## Current Issue: Alpha Vantage Free Tier Limitations

Alpha Vantage's free tier has significant limitations as of 2024-2025:
- **Only 25 API requests per day** (reduced from previous limits)
- **End-of-day data only** - no real-time prices
- **Data delay**: Free tier provides last trading day close prices
- **Real-time data requires premium** ($49.99/month minimum)

## Alternative Free Stock Price APIs

### 1. Yahoo Finance (Unofficial)
- **Status**: Free, widely used
- **Limitations**: No official API, subject to rate limiting
- **Data**: Real-time delayed quotes (15-20 minutes)
- **Implementation**: Would require scraping or unofficial libraries

### 2. Twelve Data
- **Status**: Free tier available
- **Limitations**: 800 API calls/day on free tier
- **Data**: Real-time and historical data
- **URL**: https://twelvedata.com/

### 3. Financial Modeling Prep
- **Status**: Free tier available  
- **Limitations**: 250 requests/day on free tier
- **Data**: Real-time stock prices, financial statements
- **URL**: https://financialmodelingprep.com/

### 4. Polygon.io
- **Status**: Free tier available
- **Limitations**: 5 API calls/minute on free tier
- **Data**: Real-time and historical market data
- **URL**: https://polygon.io/

### 5. IEX Cloud
- **Status**: Pay-as-you-go, low cost
- **Limitations**: No free tier, but very affordable
- **Data**: Real-time market data
- **URL**: https://iexcloud.io/

## Recommended Solutions

### Short-term (Current Alpha Vantage)
1. **Accept limitations**: Use Alpha Vantage for end-of-day portfolio tracking
2. **Clear expectations**: Inform users that prices are from last trading day
3. **Cache smartly**: Don't refresh during non-market hours

### Medium-term (Upgrade Path)
1. **Implement Twelve Data**: 800 calls/day should be sufficient for most users
2. **Add provider switching**: Allow users to configure different providers
3. **Hybrid approach**: Use Alpha Vantage as fallback, primary provider for real-time

### Long-term (Production Ready)
1. **Premium API subscription**: Alpha Vantage premium or alternative
2. **Multiple provider support**: Failover between providers
3. **Intelligent caching**: Market hours awareness, reduce API calls

## Implementation Priority

1. ✅ **Document current limitations** (this file)
2. ⏳ **Add Twelve Data provider** 
3. ⏳ **Implement provider selection in config**
4. ⏳ **Add market-hours-aware caching**
5. ⏳ **User notification for stale data**

## Configuration Example

```yaml
price_providers:
  primary: "twelvedata"
  fallback: "alphavantage" 
  
  twelvedata:
    api_key: "${TWELVE_DATA_API_KEY}"
    daily_limit: 800
    
  alphavantage:
    api_key: "${ALPHA_VANTAGE_API_KEY}"
    daily_limit: 25
    accepts_stale_data: true
```