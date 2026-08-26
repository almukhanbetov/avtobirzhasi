package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// healthCheckTimeout bounds how long the health check waits on the
// database before reporting unavailable — this endpoint is polled
// frequently (Docker healthcheck, uptime monitors) and must never hang.
const healthCheckTimeout = 2 * time.Second

// RegisterHealthRoutes wires the liveness/readiness check used by
// Docker's healthcheck and any external uptime monitor. It reports 503 if
// the database is unreachable, and never reveals internal details
// (connection strings, hostnames, stack traces) in either case.
func RegisterHealthRoutes(router *gin.RouterGroup, pool *pgxpool.Pool) {
	router.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), healthCheckTimeout)
		defer cancel()

		if err := pool.Ping(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}
