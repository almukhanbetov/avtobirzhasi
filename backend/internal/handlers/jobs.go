package handlers

import (
	"net/http"

	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// JobsHandler exposes internal, non-public endpoints for manually
// triggering scheduled jobs during development instead of waiting for the
// real cadence.
type JobsHandler struct {
	exchange *service.ExchangeService
}

// NewJobsHandler creates a JobsHandler.
func NewJobsHandler(exchange *service.ExchangeService) *JobsHandler {
	return &JobsHandler{exchange: exchange}
}

// RegisterJobsRoutes wires the internal routes. Callers must mount this
// under a router group protected by middleware.LocalOnly().
func RegisterJobsRoutes(router *gin.RouterGroup, h *JobsHandler) {
	router.POST("/jobs/run-daily-tick", h.RunDailyTick)
}

// RunDailyTick handles POST /internal/jobs/run-daily-tick — applies one
// day's Auto Exchange price movement, match creation and expiry sweep, and
// reports what happened.
func (h *JobsHandler) RunDailyTick(c *gin.Context) {
	result, err := h.exchange.RunDailyTick(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusOK, result)
}
