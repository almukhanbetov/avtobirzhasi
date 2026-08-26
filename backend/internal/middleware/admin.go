package middleware

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

const adminRole = "admin"

// AdminOnly requires a real users.role='admin' row, not just network
// position. It must be mounted after Auth() so a userID is already in the
// Gin context (see UserID) — the audit's "no admin authorization model"
// finding was that /internal/* relied solely on middleware.LocalOnly's
// TCP-peer check; this adds the actual role check LocalOnly can't provide.
//
// Distinguishes the three cases the audit asked for:
//   - no/invalid token          -> 401 (should already be caught by Auth,
//     handled here too so this middleware is safe to use standalone)
//   - authenticated, role!=admin -> 403
//   - authenticated, role=admin  -> next()
func AdminOnly(users *repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := UserID(c)
		if !ok || userID == "" {
			unauthorized(c)
			return
		}

		user, err := users.FindByID(c.Request.Context(), userID)
		if errors.Is(err, repository.ErrNotFound) {
			unauthorized(c)
			return
		}
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{"code": "INTERNAL_ERROR", "message": "Не удалось проверить права доступа"},
			})
			return
		}

		if user.Role != adminRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": gin.H{"code": "FORBIDDEN", "message": "Требуются права администратора"},
			})
			return
		}

		c.Next()
	}
}
