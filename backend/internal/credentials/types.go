package credentials

import (
	"encoding/json"
	"time"
)

// CredentialType represents the type of credential
type CredentialType string

const (
	CredentialTypeAPIKey CredentialType = "api_key"
	CredentialTypeOAuth  CredentialType = "oauth"
	CredentialTypeBasic  CredentialType = "basic_auth"
)

// ServiceType represents the financial service
type ServiceType string

const (
	ServiceTypePlaid        ServiceType = "plaid"
	ServiceTypeAllyInvest   ServiceType = "ally_invest"
	ServiceTypeKraken       ServiceType = "kraken"
	ServiceTypeFidelity     ServiceType = "fidelity"
	ServiceTypeMorganStanley ServiceType = "morgan_stanley"
	ServiceTypeMarketData   ServiceType = "market_data"
)

// Credential represents a stored credential
type Credential struct {
	ID           int           `json:"id" db:"id"`
	ServiceType  ServiceType   `json:"service_type" db:"service_type"`
	CredType     CredentialType `json:"credential_type" db:"credential_type"`
	Name         string        `json:"name" db:"name"`
	EncryptedData string       `json:"-" db:"encrypted_data"` // Never expose in JSON
	IsActive     bool          `json:"is_active" db:"is_active"`
	CreatedAt    time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at" db:"updated_at"`
	LastUsed     *time.Time    `json:"last_used,omitempty" db:"last_used"`
}

// APIKeyCredential represents API key-based credentials
type APIKeyCredential struct {
	Key        string `json:"key"`
	Secret     string `json:"secret,omitempty"`
	Environment string `json:"environment,omitempty"` // sandbox, production, etc.
}

// OAuthCredential represents OAuth-based credentials
type OAuthCredential struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
}

// BasicAuthCredential represents username/password credentials
type BasicAuthCredential struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Domain   string `json:"domain,omitempty"`
}

// CredentialData interface for type safety
type CredentialData interface {
	Validate() error
}

// Validate validates API key credentials
func (c *APIKeyCredential) Validate() error {
	if c.Key == "" {
		return ErrInvalidCredential
	}
	return nil
}

// Validate validates OAuth credentials
func (c *OAuthCredential) Validate() error {
	if c.ClientID == "" || c.ClientSecret == "" {
		return ErrInvalidCredential
	}
	return nil
}

// Validate validates basic auth credentials
func (c *BasicAuthCredential) Validate() error {
	if c.Username == "" || c.Password == "" {
		return ErrInvalidCredential
	}
	return nil
}

// ToJSON converts credential data to JSON bytes
func ToJSON(data CredentialData) ([]byte, error) {
	return json.Marshal(data)
}

// FromJSON converts JSON bytes to credential data based on type
func FromJSON(credType CredentialType, data []byte) (CredentialData, error) {
	switch credType {
	case CredentialTypeAPIKey:
		var cred APIKeyCredential
		err := json.Unmarshal(data, &cred)
		return &cred, err
	case CredentialTypeOAuth:
		var cred OAuthCredential
		err := json.Unmarshal(data, &cred)
		return &cred, err
	case CredentialTypeBasic:
		var cred BasicAuthCredential
		err := json.Unmarshal(data, &cred)
		return &cred, err
	default:
		return nil, ErrUnsupportedCredentialType
	}
}