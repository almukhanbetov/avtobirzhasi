package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterHealthRoutes wires the liveness check used to confirm the API
// process is up and serving requests.
func RegisterHealthRoutes(router *gin.RouterGroup) {
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}
