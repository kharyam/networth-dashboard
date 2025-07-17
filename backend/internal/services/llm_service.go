package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// LLMProvider represents different LLM providers
type LLMProvider string

const (
	ProviderOpenAI    LLMProvider = "openai"
	ProviderOllama    LLMProvider = "ollama"
	ProviderOpenRouter LLMProvider = "openrouter"
	ProviderUnknown   LLMProvider = "unknown"
)

// LLMService handles communication with OpenAI-compatible LLM APIs
type LLMService struct {
	apiKey     string
	baseURL    string
	model      string
	client     *http.Client
	maxRetries int
	provider   LLMProvider
}

// LLMConfig holds configuration for the LLM service
type LLMConfig struct {
	APIKey             string
	BaseURL            string
	Model              string
	MaxRetries         int
	Timeout            time.Duration
	InsecureSkipVerify bool // Skip SSL certificate verification
	Provider           string // Optional provider override
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

// detectProvider determines the LLM provider based on configuration
func detectProvider(config LLMConfig) LLMProvider {
	// Check explicit provider override first
	if config.Provider != "" {
		switch strings.ToLower(config.Provider) {
		case "ollama":
			return ProviderOllama
		case "openai":
			return ProviderOpenAI
		case "openrouter":
			return ProviderOpenRouter
		default:
			log.Printf("Unknown provider override '%s', falling back to URL detection", config.Provider)
		}
	}

	// Auto-detect based on base URL
	baseURL := strings.ToLower(config.BaseURL)
	if strings.Contains(baseURL, ":11434") {
		return ProviderOllama
	}
	if strings.Contains(baseURL, "openrouter.ai") {
		return ProviderOpenRouter
	}
	if strings.Contains(baseURL, "api.openai.com") {
		return ProviderOpenAI
	}

	// Default to OpenAI for unknown URLs
	return ProviderOpenAI
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
		config.Timeout = 5 * 60 * time.Second // 5 minutes
	}

	// Detect provider
	provider := detectProvider(config)

	// Adjust configuration for Ollama if detected
	if provider == ProviderOllama {
		// Ollama requires an API key but ignores it - use dummy value if not provided
		if config.APIKey == "" {
			config.APIKey = "ollama"
		}
		// Use default Ollama model if OpenAI model is specified
		if config.Model == "gpt-4o" || config.Model == "gpt-3.5-turbo" {
			config.Model = "llama3.2"
		}
		// For vision models, default to llava if available
		if config.Model == "gpt-4o-vision" || config.Model == "gpt-4-vision-preview" {
			config.Model = "llava"
		}
	}

	// Create HTTP client with custom transport
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: config.InsecureSkipVerify,
		},
	}

	service := &LLMService{
		apiKey:     config.APIKey,
		baseURL:    config.BaseURL,
		model:      config.Model,
		maxRetries: config.MaxRetries,
		provider:   provider,
		client: &http.Client{
			Timeout:   config.Timeout,
			Transport: transport,
		},
	}

	// Log detected provider
	log.Printf("LLM Service initialized - Provider: %s, Base URL: %s, Model: %s", 
		provider, config.BaseURL, config.Model)

	return service
}

// ChatCompletion sends a chat completion request to the LLM API
func (s *LLMService) ChatCompletion(ctx context.Context, messages []ChatMessage, options ...func(*ChatRequest)) (*ChatResponse, error) {
	log.Printf("LLM Chat Completion request - Provider: %s, Model: %s", s.provider, s.model)
	
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
			log.Printf("LLM Chat Completion successful - Provider: %s, Attempt: %d", s.provider, i+1)
			break
		}

		log.Printf("LLM Chat Completion failed - Provider: %s, Attempt: %d, Error: %v", s.provider, i+1, err)
		if i < s.maxRetries-1 {
			time.Sleep(time.Duration(i+1) * time.Second)
		}
	}

	return response, err
}

// VisionCompletion sends a vision completion request with image content
func (s *LLMService) VisionCompletion(ctx context.Context, messages []VisionMessage, options ...func(*VisionRequest)) (*ChatResponse, error) {
	log.Printf("LLM Vision Completion request - Provider: %s, Model: %s", s.provider, s.model)
	
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
			log.Printf("LLM Vision Completion successful - Provider: %s, Attempt: %d", s.provider, i+1)
			break
		}

		log.Printf("LLM Vision Completion failed - Provider: %s, Attempt: %d, Error: %v", s.provider, i+1, err)
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

	// Filter thinking tags from response content
	if len(response.Choices) > 0 {
		originalContent := response.Choices[0].Message.Content
		filteredContent := filterThinkingTags(originalContent)
		
		if len(filteredContent) != len(originalContent) {
			log.Printf("Filtered thinking tags from Chat LLM response: %d -> %d chars", 
				len(originalContent), len(filteredContent))
		}
		
		response.Choices[0].Message.Content = filteredContent
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

	// Filter thinking tags from response content
	if len(response.Choices) > 0 {
		originalContent := response.Choices[0].Message.Content
		filteredContent := filterThinkingTags(originalContent)
		
		if len(filteredContent) != len(originalContent) {
			log.Printf("Filtered thinking tags from Vision LLM response: %d -> %d chars", 
				len(originalContent), len(filteredContent))
		}
		
		response.Choices[0].Message.Content = filteredContent
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

// filterThinkingTags removes <thinking> tags and their content from LLM responses
func filterThinkingTags(content string) string {
	// Regular expression to match <thinking>...</thinking> blocks (including multiline)
	thinkingRegex := regexp.MustCompile(`(?s)<thinking>.*?</thinking>`)
	
	// Remove all thinking tag blocks
	content = thinkingRegex.ReplaceAllString(content, "")
	
	// Also handle self-closing thinking tags or malformed tags
	selfClosingRegex := regexp.MustCompile(`(?s)<thinking[^>]*/>`)
	content = selfClosingRegex.ReplaceAllString(content, "")
	
	// Handle cases where thinking tags might be on separate lines
	openTagRegex := regexp.MustCompile(`(?m)^\s*<thinking>\s*$`)
	closeTagRegex := regexp.MustCompile(`(?m)^\s*</thinking>\s*$`)
	
	// If we find isolated opening/closing tags, remove the entire section
	lines := strings.Split(content, "\n")
	var filteredLines []string
	insideThinking := false
	
	for _, line := range lines {
		if openTagRegex.MatchString(line) {
			insideThinking = true
			continue
		}
		
		if closeTagRegex.MatchString(line) {
			insideThinking = false
			continue
		}
		
		if !insideThinking {
			filteredLines = append(filteredLines, line)
		}
	}
	
	content = strings.Join(filteredLines, "\n")
	
	// Clean up any extra whitespace that may have been left behind
	content = regexp.MustCompile(`\n\s*\n\s*\n`).ReplaceAllString(content, "\n\n")
	
	return strings.TrimSpace(content)
}
