// Package middleware holds cross-cutting Gin middleware (CORS, auth,
// request logging) shared across route groups.
package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS allows the Next.js frontend to call this API from the browser,
// both during local development and from the deployed production domain.
func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://localhost:3000",
		"https://avtobirzhasi.kz",
		"https://www.avtobirzhasi.kz",
	}
	config.AllowCredentials = true
	config.AllowHeaders = append(config.AllowHeaders, "Authorization")

	return cors.New(config)
}
