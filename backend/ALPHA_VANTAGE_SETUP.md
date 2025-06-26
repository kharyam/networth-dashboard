# Alpha Vantage Stock Price Integration

This application now uses real stock prices from Alpha Vantage API instead of mock data.

## Setup Instructions

### 1. Get Alpha Vantage API Key

1. Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Click "Get your free API key today"
3. Fill out the form to get your free API key
4. Copy your API key

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Alpha Vantage API Configuration
ALPHA_VANTAGE_API_KEY=your-actual-api-key-here
ALPHA_VANTAGE_DAILY_LIMIT=25
ALPHA_VANTAGE_RATE_LIMIT=5
CACHE_REFRESH_MINUTES=15

# Market Hours Configuration (UTC times)
MARKET_OPEN_UTC=14:30   # 9:30 AM ET
MARKET_CLOSE_UTC=21:00  # 4:00 PM ET
MARKET_TIMEZONE=America/New_York

# Credential Key (Required for encrypted storage)
CREDENTIAL_KEY=your-32-character-encryption-key-here
```

### 3. How It Works

#### Market-Aware Caching
- **During market hours (9:30 AM - 4:00 PM ET)**: Prices refresh every 15 minutes
- **Outside market hours**: Prices cached for 16+ hours (until next market open)
- **API usage budget**: ~20 calls during market hours + 5 reserved for manual refresh

#### Rate Limiting
- **Daily limit**: 25 API calls per day (free tier)
- **Rate limit**: 5 API calls per minute
- **Graceful fallback**: Returns cached prices when limits are reached

#### Intelligent Fallback Strategy
1. **Primary**: Fresh API data (during market hours or when no cache exists)
2. **Secondary**: Cached data when available and fresh enough
3. **Tertiary**: Stale cached data when API fails or rate limited
4. **Emergency**: Clear error message when no cache and rate limited
5. **Development**: Mock provider only when no API key provided

**Key Improvement**: When market is closed and no cached data exists, the system will make an API call to get the most recent closing price instead of showing random mock data.

## Features

### Frontend Features
- **Market Status Indicator**: Shows if market is open/closed with countdown
- **Smart Refresh Button**: 
  - During market hours: "Refresh Prices (Last updated 12 min ago)"
  - After hours: "Refresh Prices (Market Closed - Last updated 2 hours ago)"
- **Price Freshness Indicators**: Green (< 15 min), Yellow (15-60 min), Red (> 1 hour)
- **Automatic Updates**: Market status updates every minute

### Backend Features
- **Market Hours Detection**: Automatically adjusts behavior based on trading hours
- **Intelligent Caching**: Different cache strategies for market vs. non-market hours
- **Rate Limit Protection**: Never exceeds API limits
- **Error Recovery**: Graceful handling of API failures
- **Audit Trail**: All API calls are logged with timestamps

## API Endpoints

### Stock Prices
- `POST /api/v1/prices/refresh` - Refresh all stock prices
- `POST /api/v1/prices/refresh/:symbol` - Refresh specific symbol
- `GET /api/v1/prices/status` - Get price freshness status

### Market Status
- `GET /api/v1/market/status` - Get current market status

Example market status response:
```json
{
  "is_open": true,
  "open_time": "2024-06-26T14:30:00Z",
  "close_time": "2024-06-26T21:00:00Z",
  "next_open": "2024-06-27T14:30:00Z",
  "next_close": "2024-06-26T21:00:00Z",
  "time_to_next": "2h 15m",
  "status": "open"
}
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ALPHA_VANTAGE_API_KEY` | - | Your Alpha Vantage API key (required) |
| `ALPHA_VANTAGE_DAILY_LIMIT` | 25 | Max API calls per day |
| `ALPHA_VANTAGE_RATE_LIMIT` | 5 | Max API calls per minute |
| `CACHE_REFRESH_MINUTES` | 15 | Cache duration during market hours |
| `MARKET_OPEN_UTC` | 14:30 | Market open time (UTC) |
| `MARKET_CLOSE_UTC` | 21:00 | Market close time (UTC) |
| `MARKET_TIMEZONE` | America/New_York | Market timezone |

## Troubleshooting

### No API Key
If no API key is provided, the system automatically falls back to mock data with a warning.

### API Limit Reached
When daily/rate limits are reached:
1. System serves cached prices
2. User sees "Rate limit exceeded" message
3. Manual refresh is disabled until limits reset
4. Automatic refresh continues next day

### Invalid API Key
If API key is invalid:
1. System logs error
2. Falls back to cached prices if available
3. User sees "API error" message
4. If no cache exists, shows clear error message

### Network Issues
If API is unreachable:
1. System serves cached prices if available
2. Continues trying on next refresh cycle
3. User sees last update timestamp
4. If no cache exists, shows "API unavailable" error

### No Cache + Rate Limited
This scenario now provides clear feedback:
1. System shows "Rate limit exceeded, try again later" message
2. No random mock prices are displayed
3. User understands they need to wait for rate limits to reset

## Development vs Production

### Development
- Set `ALPHA_VANTAGE_API_KEY=""` to use mock data
- Mock data includes realistic price variations
- No API calls made in development mode

### Production
- Requires valid Alpha Vantage API key
- Real-time price updates during market hours
- Intelligent caching to stay within limits

## Monitoring

The system tracks:
- API call count (daily and per-minute)
- Cache hit/miss ratios
- Price staleness
- Market status changes
- Error rates

Access monitoring at `GET /api/v1/prices/status`.