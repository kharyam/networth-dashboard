package credentials

import "errors"

var (
	// ErrCredentialNotFound is returned when a credential is not found
	ErrCredentialNotFound = errors.New("credential not found")
	
	// ErrInvalidCredential is returned when credential validation fails
	ErrInvalidCredential = errors.New("invalid credential data")
	
	// ErrUnsupportedCredentialType is returned for unsupported credential types
	ErrUnsupportedCredentialType = errors.New("unsupported credential type")
	
	// ErrEncryptionFailed is returned when encryption fails
	ErrEncryptionFailed = errors.New("encryption failed")
	
	// ErrDecryptionFailed is returned when decryption fails
	ErrDecryptionFailed = errors.New("decryption failed")
	
	// ErrCredentialExists is returned when trying to create a duplicate credential
	ErrCredentialExists = errors.New("credential already exists for this service")
	
	// ErrInvalidEncryptionKey is returned when the encryption key is invalid
	ErrInvalidEncryptionKey = errors.New("invalid encryption key")
)