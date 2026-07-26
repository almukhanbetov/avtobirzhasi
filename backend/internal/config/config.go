// Package config loads runtime configuration from environment variables
// (and an optional local .env file) into a typed struct.
package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all runtime settings the API needs to start.
type Config struct {
	DatabaseURL string
	JWTSecret   string
	Port        string
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
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
