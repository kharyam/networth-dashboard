package services

import (
	"fmt"
	"time"
	"networth-dashboard/internal/config"
)

// MarketHoursService handles market trading hours and status
type MarketHoursService struct {
	config *config.MarketConfig
	location *time.Location
}

// MarketStatus represents the current market status
type MarketStatus struct {
	IsOpen        bool      `json:"is_open"`
	OpenTime      time.Time `json:"open_time"`
	CloseTime     time.Time `json:"close_time"`
	NextOpen      time.Time `json:"next_open"`
	NextClose     time.Time `json:"next_close"`
	TimeToNext    string    `json:"time_to_next"`
	Status        string    `json:"status"` // "open", "closed", "pre_market", "after_hours"
}

// NewMarketHoursService creates a new market hours service
func NewMarketHoursService(cfg *config.MarketConfig) (*MarketHoursService, error) {
	location, err := time.LoadLocation(cfg.Timezone)
	if err != nil {
		// Fallback to UTC if timezone loading fails
		location = time.UTC
	}

	return &MarketHoursService{
		config:   cfg,
		location: location,
	}, nil
}

// IsMarketOpen returns true if the market is currently open
func (mhs *MarketHoursService) IsMarketOpen() bool {
	now := time.Now().In(mhs.location)
	
	// Check if it's a weekend
	if !mhs.config.WeekendTrades && (now.Weekday() == time.Saturday || now.Weekday() == time.Sunday) {
		return false
	}

	openTime := mhs.getTodayTime(mhs.config.OpenTimeLocal)
	closeTime := mhs.getTodayTime(mhs.config.CloseTimeLocal)

	return now.After(openTime) && now.Before(closeTime)
}

// GetMarketStatus returns detailed market status information
func (mhs *MarketHoursService) GetMarketStatus() *MarketStatus {
	now := time.Now().In(mhs.location)
	
	openTime := mhs.getTodayTime(mhs.config.OpenTimeLocal)
	closeTime := mhs.getTodayTime(mhs.config.CloseTimeLocal)
	
	isOpen := mhs.IsMarketOpen()
	
	var nextOpen, nextClose time.Time
	var status string
	
	if isOpen {
		status = "open"
		nextClose = closeTime
		nextOpen = mhs.getNextBusinessDay(openTime)
	} else {
		if now.Before(openTime) {
			status = "pre_market"
			nextOpen = openTime
			nextClose = closeTime
		} else {
			status = "after_hours"
			nextOpen = mhs.getNextBusinessDay(openTime)
			nextClose = mhs.getNextBusinessDay(closeTime)
		}
	}

	// Calculate time to next event
	var timeToNext string
	if isOpen {
		duration := nextClose.Sub(now)
		timeToNext = mhs.formatDuration(duration)
	} else {
		duration := nextOpen.Sub(now)
		timeToNext = mhs.formatDuration(duration)
	}

	return &MarketStatus{
		IsOpen:     isOpen,
		OpenTime:   openTime,
		CloseTime:  closeTime,
		NextOpen:   nextOpen,
		NextClose:  nextClose,
		TimeToNext: timeToNext,
		Status:     status,
	}
}

// ShouldRefreshPrices returns true if prices should be refreshed based on market hours and cache age
func (mhs *MarketHoursService) ShouldRefreshPrices(lastUpdate time.Time, cacheInterval time.Duration) bool {
	now := time.Now()
	
	// If lastUpdate is zero time, it means no cache exists - always refresh
	if lastUpdate.IsZero() {
		return true
	}
	
	cacheAge := now.Sub(lastUpdate)
	
	// If market is closed, refresh if cache is very stale (more than 12 hours) OR no cache exists
	if !mhs.IsMarketOpen() {
		return cacheAge > 12*time.Hour
	}
	
	// If market is open, refresh based on configured interval
	return cacheAge > cacheInterval
}

// GetSecondsUntilNextRefresh returns seconds until the next allowed refresh
func (mhs *MarketHoursService) GetSecondsUntilNextRefresh(lastUpdate time.Time, cacheInterval time.Duration) int64 {
	if !mhs.IsMarketOpen() {
		return 0 // Allow manual refresh when market is closed
	}
	
	nextRefresh := lastUpdate.Add(cacheInterval)
	now := time.Now()
	
	if now.After(nextRefresh) {
		return 0 // Can refresh now
	}
	
	return int64(nextRefresh.Sub(now).Seconds())
}

// getTodayTime parses time string (HH:MM) as UTC time and returns today's time
func (mhs *MarketHoursService) getTodayTime(timeStr string) time.Time {
	now := time.Now()
	
	// Parse the time string
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		// Fallback to current time if parsing fails
		return now
	}
	
	// Create UTC time for today with the parsed hour and minute
	return time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, time.UTC)
}

// getNextBusinessDay returns the next business day's time
func (mhs *MarketHoursService) getNextBusinessDay(baseTime time.Time) time.Time {
	nextDay := baseTime.AddDate(0, 0, 1)
	
	// Skip weekends if weekend trading is disabled
	if !mhs.config.WeekendTrades {
		for nextDay.Weekday() == time.Saturday || nextDay.Weekday() == time.Sunday {
			nextDay = nextDay.AddDate(0, 0, 1)
		}
	}
	
	return nextDay
}

// formatDuration formats a duration into a human-readable string
func (mhs *MarketHoursService) formatDuration(d time.Duration) string {
	if d < 0 {
		return "0m"
	}
	
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}

// IsBusinessDay returns true if the given time is a business day
func (mhs *MarketHoursService) IsBusinessDay(t time.Time) bool {
	if mhs.config.WeekendTrades {
		return true
	}
	
	weekday := t.Weekday()
	return weekday != time.Saturday && weekday != time.Sunday
}

// GetMarketTimeZone returns the market timezone location
func (mhs *MarketHoursService) GetMarketTimeZone() *time.Location {
	return mhs.location
}