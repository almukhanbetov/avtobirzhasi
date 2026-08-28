// Package config loads runtime configuration from environment variables
// (and an optional local .env file) into a typed struct.
package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all runtime settings the API needs to start.
type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string

	// UploadDir is the local filesystem directory listing photos are
	// written to (see handlers.UploadsHandler). Defaults to "./uploads"
	// for local dev; production overrides it to a path backed by a
	// persistent Docker volume (see docker-compose.prod.yml).
	UploadDir string
	// PublicUploadBaseURL is prefixed onto "/uploads/<name>" to build the
	// absolute URL stored in listing_images.url and returned to the
	// browser. Defaults to the local API origin; production sets it to
	// https://api.avtobirzhasi.kz.
	PublicUploadBaseURL string

	// FreedomPay credentials — see service.FreedomPayProvider. Left empty
	// means "no real provider configured": main.go falls back to
	// MockPaymentProvider and production payment stays disabled. Never
	// hardcode these; they must only ever come from the real environment
	// or a local, gitignored .env.
	FreedomPayMerchantID  string
	FreedomPaySecretKey   string
	FreedomPayTestingMode bool
	FreedomPayResultURL   string
	FreedomPaySuccessURL  string
	FreedomPayFailureURL  string
	FreedomPayBaseURL     string
}

// Load reads a local .env file if present (development convenience) and
// then builds a Config from environment variables, falling back to safe
// defaults where possible. Real environment variables always take
// precedence over .env values.
func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", ""),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		Port:        getEnv("PORT", "8080"),

		UploadDir:           getEnv("UPLOAD_DIR", "./uploads"),
		PublicUploadBaseURL: strings.TrimRight(getEnv("PUBLIC_UPLOAD_BASE_URL", "http://localhost:8080"), "/"),

		FreedomPayMerchantID:  getEnv("FREEDOMPAY_MERCHANT_ID", ""),
		FreedomPaySecretKey:   getEnv("FREEDOMPAY_SECRET_KEY", ""),
		FreedomPayTestingMode: getEnv("FREEDOMPAY_TESTING_MODE", "") == "1",
		FreedomPayResultURL:   getEnv("FREEDOMPAY_RESULT_URL", ""),
		FreedomPaySuccessURL:  getEnv("FREEDOMPAY_SUCCESS_URL", ""),
		FreedomPayFailureURL:  getEnv("FREEDOMPAY_FAILURE_URL", ""),
		FreedomPayBaseURL:     getEnv("FREEDOMPAY_BASE_URL", ""),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
