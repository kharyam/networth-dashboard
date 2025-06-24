package credentials

import (
	"database/sql"
	"time"
)

// Store handles database operations for credentials
type Store struct {
	db               *sql.DB
	encryptionService *EncryptionService
}

// NewStore creates a new credential store
func NewStore(db *sql.DB, encryptionService *EncryptionService) *Store {
	return &Store{
		db:               db,
		encryptionService: encryptionService,
	}
}

// Store saves a credential to the database
func (s *Store) Store(serviceType ServiceType, credType CredentialType, name string, data CredentialData) (*Credential, error) {
	// Validate the credential data
	if err := data.Validate(); err != nil {
		return nil, err
	}
	
	// Convert to JSON
	jsonData, err := ToJSON(data)
	if err != nil {
		return nil, err
	}
	
	// Encrypt the data
	encryptedData, err := s.encryptionService.Encrypt(jsonData)
	if err != nil {
		return nil, err
	}
	
	// Check if credential already exists
	existing, _ := s.GetByService(serviceType)
	if existing != nil {
		return nil, ErrCredentialExists
	}
	
	// Insert into database
	query := `
		INSERT INTO credentials (service_type, credential_type, name, encrypted_data, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`
	
	now := time.Now()
	var id int
	var createdAt, updatedAt time.Time
	
	err = s.db.QueryRow(query, serviceType, credType, name, encryptedData, true, now, now).
		Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	
	return &Credential{
		ID:           id,
		ServiceType:  serviceType,
		CredType:     credType,
		Name:         name,
		EncryptedData: encryptedData,
		IsActive:     true,
		CreatedAt:    createdAt,
		UpdatedAt:    updatedAt,
	}, nil
}

// GetByService retrieves a credential by service type
func (s *Store) GetByService(serviceType ServiceType) (*Credential, error) {
	query := `
		SELECT id, service_type, credential_type, name, encrypted_data, is_active, created_at, updated_at, last_used
		FROM credentials 
		WHERE service_type = $1 AND is_active = true
	`
	
	var cred Credential
	var lastUsed sql.NullTime
	
	err := s.db.QueryRow(query, serviceType).Scan(
		&cred.ID,
		&cred.ServiceType,
		&cred.CredType,
		&cred.Name,
		&cred.EncryptedData,
		&cred.IsActive,
		&cred.CreatedAt,
		&cred.UpdatedAt,
		&lastUsed,
	)
	
	if err == sql.ErrNoRows {
		return nil, ErrCredentialNotFound
	}
	if err != nil {
		return nil, err
	}
	
	if lastUsed.Valid {
		cred.LastUsed = &lastUsed.Time
	}
	
	return &cred, nil
}

// GetDecryptedData retrieves and decrypts credential data
func (s *Store) GetDecryptedData(serviceType ServiceType) (CredentialData, error) {
	cred, err := s.GetByService(serviceType)
	if err != nil {
		return nil, err
	}
	
	// Decrypt the data
	decryptedBytes, err := s.encryptionService.Decrypt(cred.EncryptedData)
	if err != nil {
		return nil, err
	}
	
	// Convert to appropriate credential type
	data, err := FromJSON(cred.CredType, decryptedBytes)
	if err != nil {
		return nil, err
	}
	
	// Update last used timestamp
	s.updateLastUsed(cred.ID)
	
	return data, nil
}

// Update updates an existing credential
func (s *Store) Update(serviceType ServiceType, data CredentialData) (*Credential, error) {
	// Validate the credential data
	if err := data.Validate(); err != nil {
		return nil, err
	}
	
	// Get existing credential
	existing, err := s.GetByService(serviceType)
	if err != nil {
		return nil, err
	}
	
	// Convert to JSON
	jsonData, err := ToJSON(data)
	if err != nil {
		return nil, err
	}
	
	// Encrypt the data
	encryptedData, err := s.encryptionService.Encrypt(jsonData)
	if err != nil {
		return nil, err
	}
	
	// Update in database
	query := `
		UPDATE credentials 
		SET encrypted_data = $1, updated_at = $2
		WHERE id = $3
	`
	
	now := time.Now()
	_, err = s.db.Exec(query, encryptedData, now, existing.ID)
	if err != nil {
		return nil, err
	}
	
	existing.EncryptedData = encryptedData
	existing.UpdatedAt = now
	
	return existing, nil
}

// Delete removes a credential
func (s *Store) Delete(serviceType ServiceType) error {
	query := `UPDATE credentials SET is_active = false WHERE service_type = $1`
	_, err := s.db.Exec(query, serviceType)
	return err
}

// List returns all active credentials (without decrypted data)
func (s *Store) List() ([]*Credential, error) {
	query := `
		SELECT id, service_type, credential_type, name, is_active, created_at, updated_at, last_used
		FROM credentials 
		WHERE is_active = true
		ORDER BY service_type
	`
	
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var credentials []*Credential
	
	for rows.Next() {
		var cred Credential
		var lastUsed sql.NullTime
		
		err := rows.Scan(
			&cred.ID,
			&cred.ServiceType,
			&cred.CredType,
			&cred.Name,
			&cred.IsActive,
			&cred.CreatedAt,
			&cred.UpdatedAt,
			&lastUsed,
		)
		if err != nil {
			return nil, err
		}
		
		if lastUsed.Valid {
			cred.LastUsed = &lastUsed.Time
		}
		
		credentials = append(credentials, &cred)
	}
	
	return credentials, rows.Err()
}

// updateLastUsed updates the last_used timestamp
func (s *Store) updateLastUsed(id int) {
	query := `UPDATE credentials SET last_used = $1 WHERE id = $2`
	s.db.Exec(query, time.Now(), id)
}