# Development Guide

This guide covers the development setup, architecture decisions, and implementation details for the Net Worth Dashboard.

## Project Structure

```
networth-dashboard/
├── backend/                    # Go API server
│   ├── internal/
│   │   ├── api/               # HTTP handlers and routing
│   │   ├── config/            # Configuration management
│   │   ├── database/          # Database connection and migrations
│   │   ├── models/            # Data models and DTOs
│   │   └── plugins/           # Plugin architecture
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   └── main.go
├── frontend/                   # React TypeScript app
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API client and utilities
│   │   ├── types/             # TypeScript type definitions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.ts
├── docs/                      # Documentation
├── docker-compose.yml
└── README.md
```

## Development Environment Setup

### Prerequisites

- **Go 1.21+** - Backend development
- **Node.js 18+** - Frontend development
- **PostgreSQL 15+** - Database
- **Docker & Docker Compose** - Containerization
- **Git** - Version control

### Local Development

#### Option 1: Full Container Setup (Recommended)

**With Docker Compose:**
```bash
# Clone and start everything
git clone <repo-url>
cd networth-dashboard
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**With Podman Compose:**
```bash
# Clone and start everything
git clone <repo-url>
cd networth-dashboard
podman-compose up -d

# View logs
podman-compose logs -f

# Stop services
podman-compose down
```

#### Option 2: Hybrid Development

Run database in containers, develop services locally:

**With Docker Compose:**
```bash
# Start only database
docker-compose up -d database
```

**With Podman Compose:**
```bash
# Start only database
podman-compose up -d database
```

# Backend development
cd backend
cp .env.example .env
# Edit .env file
go mod download
go run main.go

# Frontend development (new terminal)
cd frontend
npm install
npm run dev
```

#### Option 3: Full Local Development

```bash
# Start PostgreSQL locally
createdb networth_dashboard

# Backend
cd backend
cp .env.example .env
# Configure .env for local database
go mod download
go run main.go

# Frontend
cd frontend
npm install
npm run dev
```

## Architecture Overview

### Backend Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP Layer    │    │  Business Logic │    │   Data Layer    │
│   (Gin Router)  │────│   (Services)    │────│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │ Plugin Manager  │              │
         └──────────────│   (Extensible)  │──────────────┘
                        └─────────────────┘
```

#### Key Components

1. **Plugin Architecture**
   - Standardized interface for data sources
   - Support for API, manual, and scraping plugins
   - Hot-swappable plugin registration

2. **Configuration Management**
   - Environment-based configuration
   - Secure credential storage
   - YAML configuration support

3. **Database Layer**
   - Comprehensive financial data schema
   - Migration system
   - Connection pooling

### Frontend Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Pages       │    │   Components    │    │    Services     │
│  (Route Views)  │────│  (Reusable UI)  │────│  (API Client)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │     State       │              │
         └──────────────│  (React Hooks)  │──────────────┘
                        └─────────────────┘
```

#### Key Features

1. **Responsive Design**
   - Mobile-first approach
   - Tailwind CSS utility classes
   - Touch-friendly interfaces

2. **Interactive Charts**
   - Recharts for financial visualizations
   - Real-time data updates
   - Export capabilities

3. **Type Safety**
   - Full TypeScript coverage
   - API response types
   - Runtime validation

## Database Design

### Core Tables

#### Financial Data Flow
```
DataSources → Accounts → Balances
     ↓           ↓         ↓
  Plugins → ManualEntries → Calculations
```

#### Key Relationships

1. **Data Sources** - Plugin configurations
2. **Accounts** - Financial accounts from various sources
3. **Balances** - Time-series balance data
4. **Stock Holdings** - Equity positions with consolidation
5. **Equity Grants** - RSUs, options with vesting schedules
6. **Real Estate** - Property holdings with valuations

### Schema Patterns

```sql
-- Extensible JSON storage for plugin-specific data
data_json JSONB NOT NULL

-- Generated columns for calculated values
market_value DECIMAL(15,2) GENERATED ALWAYS AS (shares_owned * current_price) STORED

-- Audit trails for manual entries
CREATE TABLE manual_entry_log (
    id SERIAL PRIMARY KEY,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Plugin Development

### Creating a New Plugin

1. **Implement the Interface**

```go
type MyPlugin struct {
    *BasePlugin
    // Plugin-specific fields
}

func (p *MyPlugin) GetAccounts() ([]models.Account, error) {
    // Implementation
}

func (p *MyPlugin) GetBalances() ([]models.AccountBalance, error) {
    // Implementation
}
```

2. **Register the Plugin**

```go
func init() {
    plugin := &MyPlugin{
        BasePlugin: NewBasePlugin("my-plugin", PluginTypeAPI, DataSourceAPI),
    }
    
    pluginManager.RegisterPlugin(plugin)
}
```

3. **Manual Entry Support**

```go
func (p *MyPlugin) SupportsManualEntry() bool {
    return true
}

func (p *MyPlugin) GetManualEntrySchema() ManualEntrySchema {
    return ManualEntrySchema{
        Fields: []ManualEntryField{
            {
                Name:     "symbol",
                Type:     "text",
                Label:    "Stock Symbol",
                Required: true,
            },
        },
    }
}
```

## API Development

### Adding New Endpoints

1. **Define Handler**

```go
func (s *Server) getMyData(c *gin.Context) {
    // Implementation
    c.JSON(http.StatusOK, gin.H{"data": result})
}
```

2. **Add Route**

```go
api.GET("/my-data", s.getMyData)
```

3. **Update Frontend Service**

```typescript
export const myApi = {
  getData: (): Promise<MyData[]> =>
    api.get('/my-data').then(res => res.data),
}
```

## Frontend Development

### Component Structure

```typescript
// Component with proper typing
interface MyComponentProps {
  data: MyData[]
  onUpdate: (item: MyData) => void
}

function MyComponent({ data, onUpdate }: MyComponentProps) {
  // Implementation with hooks
}
```

### State Management

```typescript
// Custom hooks for data fetching
function useNetWorth() {
  const [data, setData] = useState<NetWorthSummary | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    netWorthApi.getSummary()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])
  
  return { data, loading }
}
```

## Testing Strategy

### Backend Testing

```go
func TestPlugin(t *testing.T) {
    plugin := &MyPlugin{}
    
    accounts, err := plugin.GetAccounts()
    assert.NoError(t, err)
    assert.NotEmpty(t, accounts)
}
```

### Frontend Testing

```typescript
import { render, screen } from '@testing-library/react'
import Dashboard from './Dashboard'

test('renders dashboard', () => {
  render(<Dashboard />)
  expect(screen.getByText('Net Worth')).toBeInTheDocument()
})
```

## Security Considerations

### Backend Security

1. **Credential Encryption**
   - AES-256-GCM encryption
   - Environment-based keys
   - Secure key derivation

2. **Input Validation**
   - Request validation
   - SQL injection prevention
   - XSS protection

3. **Rate Limiting**
   - Per-endpoint limits
   - IP-based restrictions
   - Configurable thresholds

### Frontend Security

1. **HTTPS Only**
   - Secure cookie settings
   - HSTS headers
   - Certificate pinning

2. **Content Security Policy**
   - Script source restrictions
   - Frame options
   - Content type validation

## Performance Optimization

### Backend Optimization

1. **Database**
   - Connection pooling
   - Query optimization
   - Proper indexing

2. **Caching**
   - In-memory caching
   - Redis integration
   - TTL management

3. **Concurrency**
   - Goroutine pools
   - Context-based cancellation
   - Graceful shutdown

### Frontend Optimization

1. **Bundle Optimization**
   - Code splitting
   - Tree shaking
   - Lazy loading

2. **Caching**
   - Browser caching
   - Service workers
   - API response caching

## Deployment

### Production Environment

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Environment variables
export DB_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 64)
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

### Monitoring

1. **Health Checks**
   - Application health endpoints
   - Database connectivity
   - Plugin status monitoring

2. **Logging**
   - Structured logging
   - Error tracking
   - Performance metrics

3. **Alerts**
   - Service availability
   - Error rate thresholds
   - Resource utilization

## Troubleshooting

### Common Issues

1. **Database Connection**
   
   **Docker Compose:**
   ```bash
   # Check database status
   docker-compose logs database
   
   # Connect to database
   docker exec -it networth-db psql -U postgres -d networth_dashboard
   ```
   
   **Podman Compose:**
   ```bash
   # Check database status
   podman-compose logs database
   
   # Connect to database
   podman exec -it networth-db psql -U postgres -d networth_dashboard
   ```

2. **API Connection**
   
   **Docker Compose:**
   ```bash
   # Check backend logs
   docker-compose logs backend
   
   # Test API endpoint
   curl http://localhost:8080/health
   ```
   
   **Podman Compose:**
   ```bash
   # Check backend logs
   podman-compose logs backend
   
   # Test API endpoint
   curl http://localhost:8080/health
   ```

3. **Frontend Issues**
   
   **Docker/Podman Compose:**
   ```bash
   # Check frontend logs
   docker-compose logs frontend  # or podman-compose logs frontend
   
   # Clear node modules and rebuild
   rm -rf frontend/node_modules frontend/package-lock.json
   cd frontend && npm install
   ```

4. **Podman-Specific Issues**
   
   ```bash
   # If containers can't communicate, check network
   podman network ls
   podman network inspect networth-dashboard_networth-network
   
   # If volume permissions issues
   sudo setsebool -P container_manage_cgroup true
   
   # If health checks fail
   podman-compose up --no-healthcheck
   ```

## Development Best Practices

1. **Code Organization**
   - Feature-based directory structure
   - Separation of concerns
   - Clear naming conventions

2. **Error Handling**
   - Proper error types
   - User-friendly messages
   - Graceful degradation

3. **Documentation**
   - Code comments
   - API documentation
   - Architecture decisions

4. **Version Control**
   - Meaningful commit messages
   - Feature branches
   - Pull request reviews