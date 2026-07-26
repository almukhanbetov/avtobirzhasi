package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const userIDContextKey = "userID"

// Auth validates the "Authorization: Bearer <token>" header. On success it
// stores the authenticated user's id in the Gin context (retrieve it with
// UserID). On failure it aborts the request with 401.
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || token == "" {
			unauthorized(c)
			return
		}

		claims := jwt.MapClaims{}
		parsed, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !parsed.Valid {
			unauthorized(c)
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok || userID == "" {
			unauthorized(c)
			return
		}

		c.Set(userIDContextKey, userID)
		c.Next()
	}
}

// UserID returns the authenticated user's id set by Auth, and whether it
// was present (it always is for any handler mounted behind Auth).
func UserID(c *gin.Context) (string, bool) {
	value, exists := c.Get(userIDContextKey)
	if !exists {
		return "", false
	}
	id, ok := value.(string)
	return id, ok
}

func unauthorized(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"error": gin.H{"code": "UNAUTHORIZED", "message": "Требуется авторизация"},
	})
}
