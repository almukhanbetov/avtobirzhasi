// Package middleware holds cross-cutting Gin middleware (CORS, auth,
// request logging) shared across route groups.
package middleware

import (
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS allows the Next.js frontend to call this API from the browser,
// both during local development and from the deployed production domain.
//
// The frontend's dev port is normally 3000, but a machine with something
// else already bound to 3000/8080 (as happened in one sandboxed session,
// forcing the dev servers onto :3001/:8081) needs its actual origin
// allowed too — without hardcoding that one-off port here permanently.
// CORS_EXTRA_ORIGINS (comma-separated, e.g.
// "http://localhost:3001,http://localhost:5173") appends to the fixed
// list below for exactly that case; unset, behavior is identical to
// before. Production's origins are always present regardless.
func CORS() gin.HandlerFunc {
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"http://localhost:3000",
		"https://avtobirzhasi.kz",
		"https://www.avtobirzhasi.kz",
	}
	if extra := os.Getenv("CORS_EXTRA_ORIGINS"); extra != "" {
		for _, origin := range strings.Split(extra, ",") {
			if origin = strings.TrimSpace(origin); origin != "" {
				config.AllowOrigins = append(config.AllowOrigins, origin)
			}
		}
	}
	config.AllowCredentials = true
	config.AllowHeaders = append(config.AllowHeaders, "Authorization")

	return cors.New(config)
}
