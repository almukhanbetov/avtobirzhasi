package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// RequestsHandler wires the authenticated /api/requests and
// /api/dashboard/requests routes.
type RequestsHandler struct {
	requests *repository.BuyerRequestRepository
}

// NewRequestsHandler creates a RequestsHandler.
func NewRequestsHandler(requests *repository.BuyerRequestRepository) *RequestsHandler {
	return &RequestsHandler{requests: requests}
}

// RegisterRequestsRoutes wires the buyer-facing request management
// routes, all behind the JWT middleware.
func RegisterRequestsRoutes(router *gin.RouterGroup, h *RequestsHandler, jwtSecret string) {
	router.POST("/requests", middleware.Auth(jwtSecret), h.Create)
	router.PATCH("/requests/:id", middleware.Auth(jwtSecret), h.Update)
	router.GET("/dashboard/requests", middleware.Auth(jwtSecret), h.ListMine)
}

type createRequestRequest struct {
	Make         string `json:"make" binding:"required"`
	Model        string `json:"model" binding:"required"`
	YearFrom     int    `json:"yearFrom" binding:"required"`
	YearTo       int    `json:"yearTo" binding:"required"`
	Region       string `json:"region" binding:"required"`
	InitialOffer int64  `json:"initialOffer" binding:"required,min=1"`
}

// Create handles POST /api/requests. current_offer starts equal to
// initial_offer; the Auto Exchange engine (Stage 6) grows it daily.
func (h *RequestsHandler) Create(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	var req createRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей заявки")
		return
	}
	if req.YearFrom > req.YearTo {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Год «от» не может быть больше года «до»")
		return
	}

	request := &models.BuyerRequest{
		UserID:       userID,
		Make:         req.Make,
		Model:        req.Model,
		YearFrom:     req.YearFrom,
		YearTo:       req.YearTo,
		Region:       req.Region,
		InitialOffer: req.InitialOffer,
	}

	if err := h.requests.Create(c.Request.Context(), request); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось создать заявку, попробуйте позже")
		return
	}

	c.JSON(http.StatusCreated, toBuyerRequestResponse(*request))
}

type updateRequestRequest struct {
	CurrentOffer *int64  `json:"currentOffer"`
	Region       *string `json:"region"`
}

// Update handles PATCH /api/requests/:id (owner only).
func (h *RequestsHandler) Update(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id := c.Param("id")

	request, err := h.requests.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Заявка не найдена")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить заявку")
		return
	}
	if request.UserID != userID {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваша заявка")
		return
	}

	var req updateRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей")
		return
	}

	fields := map[string]any{}
	if req.CurrentOffer != nil {
		fields["current_offer"] = *req.CurrentOffer
	}
	if req.Region != nil {
		fields["region"] = *req.Region
	}

	if len(fields) > 0 {
		if err := h.requests.Update(c.Request.Context(), id, fields); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить заявку")
			return
		}
	}

	updated, err := h.requests.GetByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить заявку")
		return
	}

	c.JSON(http.StatusOK, toBuyerRequestResponse(*updated))
}

// ListMine handles GET /api/dashboard/requests — the authenticated user's
// own buyer requests.
func (h *RequestsHandler) ListMine(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	items, err := h.requests.ListByUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить заявки")
		return
	}

	out := make([]buyerRequestResponse, len(items))
	for i, b := range items {
		out[i] = toBuyerRequestResponse(b)
	}

	c.JSON(http.StatusOK, out)
}
