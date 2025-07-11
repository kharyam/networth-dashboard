package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// LLMService handles communication with OpenAI-compatible LLM APIs
type LLMService struct {
	apiKey     string
	baseURL    string
	model      string
	client     *http.Client
	maxRetries int
}

// LLMConfig holds configuration for the LLM service
type LLMConfig struct {
	APIKey             string
	BaseURL            string
	Model              string
	MaxRetries         int
	Timeout            time.Duration
	InsecureSkipVerify bool // Skip SSL certificate verification
}

// ChatMessage represents a message in the chat conversation
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents a request to the chat completions API
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float32       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
}

// ChatResponse represents the response from the chat completions API
type ChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// VisionMessage represents a message with image content for vision models
type VisionMessage struct {
	Role    string `json:"role"`
	Content []struct {
		Type     string `json:"type"`
		Text     string `json:"text,omitempty"`
		ImageURL struct {
			URL string `json:"url"`
		} `json:"image_url,omitempty"`
	} `json:"content"`
}

// VisionRequest represents a request with image content
type VisionRequest struct {
	Model       string          `json:"model"`
	Messages    []VisionMessage `json:"messages"`
	Temperature float32         `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
}

// NewLLMService creates a new LLM service instance
func NewLLMService(config LLMConfig) *LLMService {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
	}
	if config.Model == "" {
		config.Model = "gpt-4o"
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.Timeout == 0 {
		config.Timeout = 60 * time.Second
	}

	// Create HTTP client with custom transport
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: config.InsecureSkipVerify,
		},
	}

	return &LLMService{
		apiKey:     config.APIKey,
		baseURL:    config.BaseURL,
		model:      config.Model,
		maxRetries: config.MaxRetries,
		client: &http.Client{
			Timeout:   config.Timeout,
			Transport: transport,
		},
	}
}

// ChatCompletion sends a chat completion request to the LLM API
func (s *LLMService) ChatCompletion(ctx context.Context, messages []ChatMessage, options ...func(*ChatRequest)) (*ChatResponse, error) {
	request := &ChatRequest{
		Model:    s.model,
		Messages: messages,
	}

	// Apply options
	for _, option := range options {
		option(request)
	}

	var response *ChatResponse
	var err error

	for i := 0; i < s.maxRetries; i++ {
		response, err = s.sendChatRequest(ctx, request)
		if err == nil {
			break
		}

		if i < s.maxRetries-1 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}

	return response, err
}

// VisionCompletion sends a vision completion request with image content
func (s *LLMService) VisionCompletion(ctx context.Context, messages []VisionMessage, options ...func(*VisionRequest)) (*ChatResponse, error) {
	request := &VisionRequest{
		Model:    s.model,
		Messages: messages,
	}

	// Apply options
	for _, option := range options {
		option(request)
	}

	var response *ChatResponse
	var err error

	for i := 0; i < s.maxRetries; i++ {
		response, err = s.sendVisionRequest(ctx, request)
		if err == nil {
			break
		}

		if i < s.maxRetries-1 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}

	return response, err
}

// sendChatRequest sends a chat request to the API
func (s *LLMService) sendChatRequest(ctx context.Context, request *ChatRequest) (*ChatResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// sendVisionRequest sends a vision request to the API
func (s *LLMService) sendVisionRequest(ctx context.Context, request *VisionRequest) (*ChatResponse, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var response ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &response, nil
}

// WithTemperature sets the temperature for the request
func WithTemperature(temperature float32) func(*ChatRequest) {
	return func(r *ChatRequest) {
		r.Temperature = temperature
	}
}

// WithMaxTokens sets the max tokens for the request
func WithMaxTokens(maxTokens int) func(*ChatRequest) {
	return func(r *ChatRequest) {
		r.MaxTokens = maxTokens
	}
}

// WithVisionTemperature sets the temperature for vision requests
func WithVisionTemperature(temperature float32) func(*VisionRequest) {
	return func(r *VisionRequest) {
		r.Temperature = temperature
	}
}

// WithVisionMaxTokens sets the max tokens for vision requests
func WithVisionMaxTokens(maxTokens int) func(*VisionRequest) {
	return func(r *VisionRequest) {
		r.MaxTokens = maxTokens
	}
}
