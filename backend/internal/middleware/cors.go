// Package middleware holds cross-cutting Gin middleware (CORS, auth,
// request logging) shared across route groups.
package middleware

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS allows the local Next.js frontend to call this API from the
// browser during development.
func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:3000"}
	config.AllowCredentials = true
	config.AllowHeaders = append(config.AllowHeaders, "Authorization")

	return cors.New(config)
}
