package middleware

import (
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
)

// LocalOnly rejects any request whose actual TCP peer is not localhost.
// Used for internal/debug routes (e.g. the manual Auto Exchange tick
// trigger) that must never be reachable from the public internet.
//
// This deliberately reads c.Request.RemoteAddr — the raw socket peer
// address — instead of c.ClientIP(). ClientIP() honors
// X-Forwarded-For/X-Real-IP whenever Gin is in its default
// "trust all proxies" mode (which this project's router is, and the
// startup log warns about it), so it can be spoofed by anyone by simply
// setting that header — confirmed while building this: sending
// `X-Forwarded-For: 127.0.0.1` from a non-local client made ClientIP()
// falsely report "127.0.0.1" and let the request through. RemoteAddr comes
// from the actual accepted TCP connection and cannot be set via headers.
func LocalOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		host, _, err := net.SplitHostPort(c.Request.RemoteAddr)
		if err != nil {
			host = c.Request.RemoteAddr
		}
		if host != "127.0.0.1" && host != "::1" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Недоступно"},
			})
			return
		}
		c.Next()
	}
}
