package credentials

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"golang.org/x/crypto/pbkdf2"
)

// EncryptionService handles encryption and decryption of credential data
type EncryptionService struct {
	key []byte
}

// NewEncryptionService creates a new encryption service
func NewEncryptionService(masterKey string) (*EncryptionService, error) {
	if len(masterKey) < 16 {
		return nil, ErrInvalidEncryptionKey
	}
	
	// Derive a 32-byte key using PBKDF2
	salt := []byte("networth-dashboard-salt") // In production, use a random salt per installation
	key := pbkdf2.Key([]byte(masterKey), salt, 10000, 32, sha256.New)
	
	return &EncryptionService{
		key: key,
	}, nil
}

// Encrypt encrypts data using AES-GCM
func (e *EncryptionService) Encrypt(plaintext []byte) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", ErrEncryptionFailed
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", ErrEncryptionFailed
	}
	
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", ErrEncryptionFailed
	}
	
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts data using AES-GCM
func (e *EncryptionService) Decrypt(encryptedData string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(encryptedData)
	if err != nil {
		return nil, ErrDecryptionFailed
	}
	
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, ErrDecryptionFailed
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrDecryptionFailed
	}
	
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return nil, ErrDecryptionFailed
	}
	
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}
	
	return plaintext, nil
}