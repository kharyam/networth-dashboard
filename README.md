# Net Worth Dashboard

A comprehensive real-time net worth dashboard that aggregates financial data from multiple sources using a plugin architecture for easy extensibility.

## Features

- **Real-time net worth calculation** with prominent display
- **Interactive charts** showing balance trends over time
- **Account breakdown** by institution and type
- **Portfolio allocation** visualizations
- **Historical performance** tracking
- **Automated data refresh** with configurable intervals
- **Manual entry system** for immediate use
- **Stock consolidation** across all platforms
- **Equity compensation tracking** with vesting schedules
- **Real estate** portfolio management

## Technology Stack

### Backend
- **Go** with Gin framework
- **PostgreSQL** database
- **Plugin architecture** for extensible data sources
- **RESTful API** with comprehensive endpoints
- **Docker** containerization

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Vite** for fast development and building
- **Responsive design** with mobile-first approach

## Quick Start

### Prerequisites

- Docker and Docker Compose (or Podman and podman-compose)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd networth-dashboard
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration
   ```

3. **Start the application**
   
   **With Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   
   **With Podman Compose:**
   ```bash

   # Cleanly restart everything for development and show logs:
   podman-compose down -v --remove-orphans ; podman system prune -af ; podman-compose build --no-cache ; set -a && source .env && set +a && podman-compose up

   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Health check: http://localhost:8080/health

### Development Setup

For local development without Docker:

#### Backend Development

1. **Prerequisites**
   - Go 1.21 or later
   - PostgreSQL 15 or later

2. **Setup**
   ```bash
   cd backend
   
   # Install dependencies
   go mod download
   
   # Set up database
   createdb networth_dashboard
   
   # Copy environment file
   cp .env.example .env
   # Edit .env with your database configuration
   
   # Run the application
   go run main.go
   ```

#### Frontend Development

1. **Prerequisites**
   - Node.js 18 or later
   - npm or yarn

2. **Setup**
   ```bash
   cd frontend
   
   # Install dependencies
   npm install
   
   # Start development server
   npm run dev
   ```

## Helm Deployment

The application can be deployed to Kubernetes using the provided Helm chart.

### Prerequisites

- A Kubernetes cluster (e.g., Minikube, Docker Desktop, OpenShift, GKE, EKS, AKS)
- [Helm](https://helm.sh/docs/intro/install/) version 3+
- A container registry (e.g., Docker Hub, GCR, ECR, Quay.io) to store your built images.
- An Ingress controller installed in your cluster (e.g., NGINX Ingress Controller, Traefik).

### Setup

1.  **Build and Push Docker Images:**

    Build the backend and frontend images and push them to your container registry.

    ```bash
    # Example for backend
    docker build -t your-registry/networth-backend:latest ./backend
    docker push your-registry/networth-backend:latest

    # Example for frontend
    docker build -t your-registry/networth-frontend:latest ./frontend
    docker push your-registry/networth-frontend:latest
    ```

2.  **Configure Chart Values:**

    Update `helm/networth-dashboard/values.yaml` to point to the images you just pushed.

    ```yaml
    backend:
      image:
        repository: your-registry/networth-backend
        tag: "latest"

    frontend:
      image:
        repository: your-registry/networth-frontend
        tag: "latest"
    ```

3.  **Create Secrets File:**

    The chart separates sensitive data into a `secrets.yaml` file. Create this file from the provided template.

    ```bash
    cp helm/networth-dashboard/secrets.yaml.gotmpl helm/networth-dashboard/secrets.yaml
    ```

    Now, edit `helm/networth-dashboard/secrets.yaml` and fill in all the required sensitive values. **This file should never be committed to version control.**

4.  **Install the Chart:**

    Use the `helm install` command to deploy the application. You must include your `secrets.yaml` file.

    ```bash
    helm dependency update helm/networht-dashboard
    helm install my-release helm/networth-dashboard -f helm/networth-dashboard/secrets.yaml
    ```

    Replace `my-release` with a name for your deployment.

5.  **Access Your Application:**

    The chart will create Ingress resources for the frontend and backend. You can get the URLs from the post-installation notes or by running:

    ```bash
    kubectl get ingress
    ```

### Uninstalling the Chart

To uninstall the deployment, run:

```bash
helm uninstall my-release
```

## API Documentation

### Health Check
- `GET /health` - Application health status

### Net Worth
- `GET /api/v1/net-worth` - Current net worth summary
- `GET /api/v1/net-worth/history` - Historical net worth data

### Accounts
- `GET /api/v1/accounts` - List all accounts
- `GET /api/v1/accounts/:id` - Get specific account
- `POST /api/v1/accounts` - Create new account
- `PUT /api/v1/accounts/:id` - Update account
- `DELETE /api/v1/accounts/:id` - Delete account

### Stock Holdings
- `GET /api/v1/stocks` - List all stock holdings
- `GET /api/v1/stocks/consolidated` - Consolidated stock view
- `POST /api/v1/stocks` - Create stock holding
- `PUT /api/v1/stocks/:id` - Update stock holding
- `DELETE /api/v1/stocks/:id` - Delete stock holding

### Equity Compensation
- `GET /api/v1/equity` - List equity grants
- `GET /api/v1/equity/:id/vesting` - Get vesting schedule
- `POST /api/v1/equity` - Create equity grant
- `PUT /api/v1/equity/:id` - Update equity grant
- `DELETE /api/v1/equity/:id` - Delete equity grant

### Real Estate
- `GET /api/v1/real-estate` - List properties
- `POST /api/v1/real-estate` - Create property
- `PUT /api/v1/real-estate/:id` - Update property
- `DELETE /api/v1/real-estate/:id` - Delete property

### Plugins
- `GET /api/v1/plugins` - List available plugins
- `GET /api/v1/plugins/:name/schema` - Get plugin schema
- `POST /api/v1/plugins/:name/manual-entry` - Process manual entry
- `POST /api/v1/plugins/refresh` - Refresh plugin data
- `GET /api/v1/plugins/health` - Plugin health status

## Database Schema

The application uses PostgreSQL with the following main tables:

- **data_sources** - Plugin/data source configurations
- **accounts** - Financial accounts from various sources
- **account_balances** - Historical balance data
- **stock_holdings** - Stock positions across platforms
- **equity_grants** - RSUs, options, and other equity compensation
- **vesting_schedule** - Equity vesting timeline
- **real_estate** - Property holdings and valuations
- **net_worth_snapshots** - Historical net worth calculations

## Architecture

### Plugin System

The application uses a plugin architecture to support multiple data sources:

```go
type FinancialDataPlugin interface {
    GetName() string
    GetType() PluginType
    GetDataSource() DataSourceType
    Initialize(config PluginConfig) error
    Authenticate() error
    GetAccounts() ([]Account, error)
    GetBalances() ([]Balance, error)
    SupportsManualEntry() bool
    GetManualEntrySchema() ManualEntrySchema
    ProcessManualEntry(data interface{}) error
}
```

### Manual Entry First

The system is designed with a "manual entry first" approach:
1. Start tracking immediately with manual data entry
2. Add API integrations progressively
3. Use manual entry as backup for API failures
4. Maintain complete control over data accuracy

## Environment Variables

### Backend (.env)

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=networth_dashboard
DB_SSLMODE=disable

# Server
PORT=8080

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-char-encryption-key

# Rate Limiting
RATE_LIMIT_RPS=100
```

## Development Workflow

1. **Phase 1** (Current): Foundation & Architecture
   - ✅ Project structure
   - ✅ Database schema
   - ✅ Backend API framework
   - ✅ Frontend dashboard
   - ✅ Docker setup

2. **Phase 2**: Manual Entry System
   - Comprehensive manual entry forms
   - Data validation and smart features
   - Bulk import/export capabilities

3. **Phase 3**: API Integrations
   - Priority APIs (Kraken, Ally, Fidelity)
   - Market data integration
   - OAuth flows

4. **Phase 4**: Advanced Features
   - Web scraping capabilities
   - Advanced analytics
   - Alert system

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- All credentials are encrypted at rest
- Environment-based configuration
- JWT-based authentication preparation
- Rate limiting and input validation
- Docker security best practices

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] Complete manual entry system
- [ ] API integrations (Kraken, Ally, Fidelity)
- [ ] Plaid banking integration
- [ ] Advanced portfolio analytics
- [ ] Mobile app development
- [ ] Multi-user support
- [ ] Advanced security features
