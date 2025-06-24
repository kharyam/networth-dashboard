package credentials

import (
	"database/sql"
)

// Manager provides the main interface for credential management
type Manager struct {
	store *Store
}

// NewManager creates a new credential manager
func NewManager(db *sql.DB, encryptionKey string) (*Manager, error) {
	encryptionService, err := NewEncryptionService(encryptionKey)
	if err != nil {
		return nil, err
	}
	
	store := NewStore(db, encryptionService)
	
	return &Manager{
		store: store,
	}, nil
}

// StoreAPIKey stores API key credentials
func (m *Manager) StoreAPIKey(serviceType ServiceType, name, key, secret, environment string) (*Credential, error) {
	cred := &APIKeyCredential{
		Key:         key,
		Secret:      secret,
		Environment: environment,
	}
	
	return m.store.Store(serviceType, CredentialTypeAPIKey, name, cred)
}

// StoreOAuth stores OAuth credentials
func (m *Manager) StoreOAuth(serviceType ServiceType, name, clientID, clientSecret string) (*Credential, error) {
	cred := &OAuthCredential{
		ClientID:     clientID,
		ClientSecret: clientSecret,
	}
	
	return m.store.Store(serviceType, CredentialTypeOAuth, name, cred)
}

// StoreBasicAuth stores basic authentication credentials
func (m *Manager) StoreBasicAuth(serviceType ServiceType, name, username, password, domain string) (*Credential, error) {
	cred := &BasicAuthCredential{
		Username: username,
		Password: password,
		Domain:   domain,
	}
	
	return m.store.Store(serviceType, CredentialTypeBasic, name, cred)
}

// GetCredential retrieves and decrypts credential data
func (m *Manager) GetCredential(serviceType ServiceType) (CredentialData, error) {
	return m.store.GetDecryptedData(serviceType)
}

// GetAPIKey retrieves API key credentials
func (m *Manager) GetAPIKey(serviceType ServiceType) (*APIKeyCredential, error) {
	data, err := m.store.GetDecryptedData(serviceType)
	if err != nil {
		return nil, err
	}
	
	apiKey, ok := data.(*APIKeyCredential)
	if !ok {
		return nil, ErrUnsupportedCredentialType
	}
	
	return apiKey, nil
}

// GetOAuth retrieves OAuth credentials
func (m *Manager) GetOAuth(serviceType ServiceType) (*OAuthCredential, error) {
	data, err := m.store.GetDecryptedData(serviceType)
	if err != nil {
		return nil, err
	}
	
	oauth, ok := data.(*OAuthCredential)
	if !ok {
		return nil, ErrUnsupportedCredentialType
	}
	
	return oauth, nil
}

// GetBasicAuth retrieves basic auth credentials
func (m *Manager) GetBasicAuth(serviceType ServiceType) (*BasicAuthCredential, error) {
	data, err := m.store.GetDecryptedData(serviceType)
	if err != nil {
		return nil, err
	}
	
	basicAuth, ok := data.(*BasicAuthCredential)
	if !ok {
		return nil, ErrUnsupportedCredentialType
	}
	
	return basicAuth, nil
}

// UpdateAPIKey updates API key credentials
func (m *Manager) UpdateAPIKey(serviceType ServiceType, key, secret, environment string) (*Credential, error) {
	cred := &APIKeyCredential{
		Key:         key,
		Secret:      secret,
		Environment: environment,
	}
	
	return m.store.Update(serviceType, cred)
}

// UpdateOAuth updates OAuth credentials
func (m *Manager) UpdateOAuth(serviceType ServiceType, clientID, clientSecret, accessToken, refreshToken string) (*Credential, error) {
	cred := &OAuthCredential{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}
	
	return m.store.Update(serviceType, cred)
}

// DeleteCredential removes a credential
func (m *Manager) DeleteCredential(serviceType ServiceType) error {
	return m.store.Delete(serviceType)
}

// ListCredentials returns all credentials (without sensitive data)
func (m *Manager) ListCredentials() ([]*Credential, error) {
	return m.store.List()
}

// TestCredential validates that a credential can be retrieved and decrypted
func (m *Manager) TestCredential(serviceType ServiceType) error {
	_, err := m.store.GetDecryptedData(serviceType)
	return err
}