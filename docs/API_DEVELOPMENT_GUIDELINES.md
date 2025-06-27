# API Development Guidelines

## Swagger Documentation Requirements

**IMPORTANT: Every new API endpoint MUST include complete Swagger annotations.**

### Required Annotations for Every Endpoint

```go
// @Summary [Brief action description]
// @Description [Detailed endpoint purpose and behavior]
// @Tags [category]
// @Accept json
// @Produce json
// @Param [name] [in] [type] [required] "[description]"  // For each parameter
// @Success 200 {object} ResponseType "Success description"
// @Failure 400 {object} map[string]interface{} "Bad request"
// @Failure 404 {object} map[string]interface{} "Not found"     // If applicable
// @Failure 500 {object} map[string]interface{} "Internal error"
// @Router /endpoint [method]
func (s *Server) handlerName(c *gin.Context) {
    // Implementation
}
```

### Tag Categories

Use these standardized tags:
- `net-worth` - Net worth calculations and history
- `accounts` - Financial account management
- `stocks` - Stock holdings and market data
- `equity` - Equity compensation (options, RSUs)
- `real-estate` - Property management and valuation
- `crypto` - Cryptocurrency holdings and prices
- `plugins` - Plugin system and data sources
- `credentials` - API credential management
- `balances` - Account balance information
- `manual-entries` - Manual data entry system
- `prices` - Price refresh and market data
- `property-valuation` - Property valuation services
- `system` - Health checks and system info

### Parameter Documentation

**Path Parameters:**
```go
// @Param id path string true "Resource ID"
```

**Query Parameters:**
```go
// @Param limit query int false "Number of results to return"
// @Param filter query string false "Filter criteria"
```

**Request Body:**
```go
// @Param request body RequestType true "Request payload"
```

### Response Documentation

**Success Responses:**
```go
// @Success 200 {object} ResponseType "Success description"
// @Success 201 {object} ResponseType "Created successfully"
```

**Error Responses:**
```go
// @Failure 400 {object} map[string]interface{} "Bad request - invalid input"
// @Failure 401 {object} map[string]interface{} "Unauthorized"
// @Failure 404 {object} map[string]interface{} "Resource not found"
// @Failure 500 {object} map[string]interface{} "Internal server error"
```

## Development Workflow

### Before Adding New Endpoints:

1. **Plan the endpoint** - Define purpose, parameters, responses
2. **Choose appropriate tag** - Use existing categories when possible
3. **Write complete annotations** - Include all required fields
4. **Test documentation** - Run `swag init` and verify in Swagger UI

### After Adding New Endpoints:

1. **Regenerate docs**: Run `swag init` in backend directory
2. **Verify in Swagger UI**: Check that endpoint appears correctly
3. **Test endpoint**: Use Swagger UI to test the endpoint
4. **Update this guide**: If new patterns emerge, document them

## Common Patterns

### CRUD Operations:
```go
// GET /resource
// @Summary Get all resources
// @Router /resource [get]

// GET /resource/{id}  
// @Summary Get resource by ID
// @Param id path string true "Resource ID"
// @Router /resource/{id} [get]

// POST /resource
// @Summary Create new resource
// @Router /resource [post]

// PUT /resource/{id}
// @Summary Update resource
// @Param id path string true "Resource ID"
// @Router /resource/{id} [put]

// DELETE /resource/{id}
// @Summary Delete resource
// @Param id path string true "Resource ID"
// @Router /resource/{id} [delete]
```

### Status/Health Endpoints:
```go
// @Summary Get service status
// @Description Check service health and availability
// @Tags system
// @Success 200 {object} map[string]interface{} "Service status"
// @Router /service/status [get]
```

### Refresh/Action Endpoints:
```go
// @Summary Refresh data
// @Description Trigger data refresh from external sources
// @Tags [category]
// @Success 200 {object} map[string]interface{} "Refresh completed"
// @Router /service/refresh [post]
```

## Validation Checklist

Before committing code with new endpoints:

- [ ] All endpoints have @Summary
- [ ] All endpoints have @Description  
- [ ] All endpoints have @Tags
- [ ] All parameters documented with @Param
- [ ] Success responses documented with @Success
- [ ] Error responses documented with @Failure
- [ ] Router path matches actual route in server.go
- [ ] HTTP method matches route definition
- [ ] `swag init` runs without errors
- [ ] Endpoint appears in Swagger UI
- [ ] Endpoint documentation is accurate and helpful

## Regenerating Documentation

After any changes to endpoint annotations:

```bash
cd backend/
swag init
```

This updates:
- `docs/swagger.json` - OpenAPI specification
- `docs/swagger.yaml` - YAML format specification  
- `docs/docs.go` - Go documentation file

The Docker build process automatically runs `swag init` during container builds.

## Tools and Scripts

### Future Automation Ideas:
- Script to validate all endpoints have documentation
- CI check to ensure new routes include annotations
- Automated comparison of routes vs documented endpoints

**Remember: Undocumented APIs are incomplete APIs. Always document as you develop!**