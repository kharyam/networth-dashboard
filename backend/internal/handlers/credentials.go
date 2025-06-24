package handlers

import (
	"encoding/json"
	"net/http"
	"networth-dashboard/internal/credentials"

	"github.com/gin-gonic/gin"
)

type CredentialHandler struct {
	manager *credentials.Manager
}

func NewCredentialHandler(manager *credentials.Manager) *CredentialHandler {
	return &CredentialHandler{
		manager: manager,
	}
}

// CreateCredentialRequest represents the request body for creating credentials
type CreateCredentialRequest struct {
	ServiceType string          `json:"service_type" binding:"required"`
	Name        string          `json:"name" binding:"required"`
	Type        string          `json:"type" binding:"required"`
	Data        json.RawMessage `json:"data" binding:"required"`
}

// CreateCredential creates a new credential
func (h *CredentialHandler) CreateCredential(c *gin.Context) {
	var req CreateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serviceType := credentials.ServiceType(req.ServiceType)
	credType := credentials.CredentialType(req.Type)

	var cred *credentials.Credential
	var err error

	switch credType {
	case credentials.CredentialTypeAPIKey:
		var apiKeyData struct {
			Key         string `json:"key"`
			Secret      string `json:"secret"`
			Environment string `json:"environment"`
		}
		if err := json.Unmarshal(req.Data, &apiKeyData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid API key data"})
			return
		}
		cred, err = h.manager.StoreAPIKey(serviceType, req.Name, apiKeyData.Key, apiKeyData.Secret, apiKeyData.Environment)

	case credentials.CredentialTypeOAuth:
		var oauthData struct {
			ClientID     string `json:"client_id"`
			ClientSecret string `json:"client_secret"`
		}
		if err := json.Unmarshal(req.Data, &oauthData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OAuth data"})
			return
		}
		cred, err = h.manager.StoreOAuth(serviceType, req.Name, oauthData.ClientID, oauthData.ClientSecret)

	case credentials.CredentialTypeBasic:
		var basicData struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Domain   string `json:"domain"`
		}
		if err := json.Unmarshal(req.Data, &basicData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid basic auth data"})
			return
		}
		cred, err = h.manager.StoreBasicAuth(serviceType, req.Name, basicData.Username, basicData.Password, basicData.Domain)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported credential type"})
		return
	}

	if err != nil {
		if err == credentials.ErrCredentialExists {
			c.JSON(http.StatusConflict, gin.H{"error": "Credential already exists for this service"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cred)
}

// GetCredential retrieves a credential by service type
func (h *CredentialHandler) GetCredential(c *gin.Context) {
	serviceTypeStr := c.Param("serviceType")
	serviceType := credentials.ServiceType(serviceTypeStr)

	data, err := h.manager.GetCredential(serviceType)
	if err != nil {
		if err == credentials.ErrCredentialNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": data})
}

// UpdateCredentialRequest represents the request body for updating credentials
type UpdateCredentialRequest struct {
	Type string          `json:"type" binding:"required"`
	Data json.RawMessage `json:"data" binding:"required"`
}

// UpdateCredential updates an existing credential
func (h *CredentialHandler) UpdateCredential(c *gin.Context) {
	serviceTypeStr := c.Param("serviceType")
	serviceType := credentials.ServiceType(serviceTypeStr)

	var req UpdateCredentialRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	credType := credentials.CredentialType(req.Type)

	var cred *credentials.Credential
	var err error

	switch credType {
	case credentials.CredentialTypeAPIKey:
		var apiKeyData struct {
			Key         string `json:"key"`
			Secret      string `json:"secret"`
			Environment string `json:"environment"`
		}
		if err := json.Unmarshal(req.Data, &apiKeyData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid API key data"})
			return
		}
		cred, err = h.manager.UpdateAPIKey(serviceType, apiKeyData.Key, apiKeyData.Secret, apiKeyData.Environment)

	case credentials.CredentialTypeOAuth:
		var oauthData struct {
			ClientID     string `json:"client_id"`
			ClientSecret string `json:"client_secret"`
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		if err := json.Unmarshal(req.Data, &oauthData); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid OAuth data"})
			return
		}
		cred, err = h.manager.UpdateOAuth(serviceType, oauthData.ClientID, oauthData.ClientSecret, oauthData.AccessToken, oauthData.RefreshToken)

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported credential type"})
		return
	}

	if err != nil {
		if err == credentials.ErrCredentialNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cred)
}

// DeleteCredential removes a credential
func (h *CredentialHandler) DeleteCredential(c *gin.Context) {
	serviceTypeStr := c.Param("serviceType")
	serviceType := credentials.ServiceType(serviceTypeStr)

	err := h.manager.DeleteCredential(serviceType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Credential deleted successfully"})
}

// ListCredentials returns all credentials (without sensitive data)
func (h *CredentialHandler) ListCredentials(c *gin.Context) {
	credentials, err := h.manager.ListCredentials()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"credentials": credentials})
}

// TestCredential validates that a credential can be retrieved
func (h *CredentialHandler) TestCredential(c *gin.Context) {
	serviceTypeStr := c.Param("serviceType")
	serviceType := credentials.ServiceType(serviceTypeStr)

	err := h.manager.TestCredential(serviceType)
	if err != nil {
		if err == credentials.ErrCredentialNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Credential not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Credential is valid and accessible"})
}

// GetSupportedServices returns the list of supported service types
func (h *CredentialHandler) GetSupportedServices(c *gin.Context) {
	services := []map[string]interface{}{
		{
			"service_type":    string(credentials.ServiceTypePlaid),
			"name":           "Plaid",
			"credential_type": string(credentials.CredentialTypeAPIKey),
			"description":    "Bank account aggregation service",
		},
		{
			"service_type":    string(credentials.ServiceTypeAllyInvest),
			"name":           "Ally Invest",
			"credential_type": string(credentials.CredentialTypeOAuth),
			"description":    "Investment account access",
		},
		{
			"service_type":    string(credentials.ServiceTypeKraken),
			"name":           "Kraken",
			"credential_type": string(credentials.CredentialTypeAPIKey),
			"description":    "Cryptocurrency exchange",
		},
		{
			"service_type":    string(credentials.ServiceTypeFidelity),
			"name":           "Fidelity",
			"credential_type": string(credentials.CredentialTypeOAuth),
			"description":    "Investment and retirement accounts",
		},
		{
			"service_type":    string(credentials.ServiceTypeMorganStanley),
			"name":           "Morgan Stanley",
			"credential_type": string(credentials.CredentialTypeOAuth),
			"description":    "Wealth management platform",
		},
		{
			"service_type":    string(credentials.ServiceTypeMarketData),
			"name":           "Market Data API",
			"credential_type": string(credentials.CredentialTypeAPIKey),
			"description":    "Stock price and market data",
		},
	}

	c.JSON(http.StatusOK, gin.H{"services": services})
}

// RegisterCredentialRoutes registers all credential-related routes
func RegisterCredentialRoutes(router *gin.RouterGroup, handler *CredentialHandler) {
	credentials := router.Group("/credentials")
	{
		credentials.GET("/services", handler.GetSupportedServices)
		credentials.GET("", handler.ListCredentials)
		credentials.POST("", handler.CreateCredential)
		credentials.GET("/:serviceType", handler.GetCredential)
		credentials.PUT("/:serviceType", handler.UpdateCredential)
		credentials.DELETE("/:serviceType", handler.DeleteCredential)
		credentials.POST("/:serviceType/test", handler.TestCredential)
	}
}