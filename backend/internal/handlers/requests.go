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
	requests  *repository.BuyerRequestRepository
	locations *repository.LocationRepository
}

// NewRequestsHandler creates a RequestsHandler.
func NewRequestsHandler(requests *repository.BuyerRequestRepository, locations *repository.LocationRepository) *RequestsHandler {
	return &RequestsHandler{requests: requests, locations: locations}
}

// RegisterRequestsRoutes wires the buyer-facing request management
// routes, all behind the JWT middleware.
func RegisterRequestsRoutes(router *gin.RouterGroup, h *RequestsHandler, jwtSecret string) {
	router.POST("/requests", middleware.Auth(jwtSecret), h.Create)
	router.PATCH("/requests/:id", middleware.Auth(jwtSecret), h.Update)
	router.DELETE("/requests/:id", middleware.Auth(jwtSecret), h.Cancel)
	router.GET("/dashboard/requests", middleware.Auth(jwtSecret), h.ListMine)
}

type createRequestRequest struct {
	Make         string `json:"make" binding:"required"`
	Model        string `json:"model" binding:"required"`
	YearFrom     int    `json:"yearFrom" binding:"required"`
	YearTo       int    `json:"yearTo" binding:"required"`
	Region       string `json:"region" binding:"required"`
	InitialOffer int64  `json:"initialOffer" binding:"required,min=1"`
	// Stage 6А: optional structured location, alongside the legacy Region
	// text above (required, what Match reads). Same rules as
	// createListingRequest — CityID must belong to RegionID, DistrictID
	// must belong to CityID, checked by the shared validLocation; the
	// stored Region text is re-derived from the reference data when
	// RegionID is present (resolveLocationText), never trusted verbatim.
	RegionID   *string `json:"regionId" binding:"omitempty,uuid"`
	CityID     *string `json:"cityId" binding:"omitempty,uuid"`
	DistrictID *string `json:"districtId" binding:"omitempty,uuid"`
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

	if !validLocation(c, h.locations, req.RegionID, req.CityID, req.DistrictID) {
		return
	}
	regionText := req.Region
	if derived, ok, err := resolveLocationText(c.Request.Context(), h.locations, req.RegionID, req.CityID); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось создать заявку, попробуйте позже")
		return
	} else if ok {
		regionText = derived
	}

	request := &models.BuyerRequest{
		UserID:       userID,
		Make:         req.Make,
		Model:        req.Model,
		YearFrom:     req.YearFrom,
		YearTo:       req.YearTo,
		Region:       regionText,
		RegionID:     req.RegionID,
		CityID:       req.CityID,
		DistrictID:   req.DistrictID,
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
	Region       *string `json:"region" binding:"omitempty,min=1"`
	// Stage 6Б: same optional structured location as createRequestRequest.
	// When RegionID is present, CityID/DistrictID (even if absent) fully
	// replace the stored location together — see buildListingFieldUpdate's
	// doc comment (listings.go) for why: a region change without a fresh
	// city must not leave the old city/district behind.
	RegionID   *string `json:"regionId" binding:"omitempty,uuid"`
	CityID     *string `json:"cityId" binding:"omitempty,uuid"`
	DistrictID *string `json:"districtId" binding:"omitempty,uuid"`
}

// loadOwnedRequest loads a buyer request and verifies the authenticated
// user owns it, writing the appropriate error response and returning
// ok=false if not — same pattern as ListingsHandler.loadOwnedListing.
func (h *RequestsHandler) loadOwnedRequest(c *gin.Context, userID, id string) (*models.BuyerRequest, bool) {
	request, err := h.requests.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Заявка не найдена")
		return nil, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить заявку")
		return nil, false
	}
	if request.UserID != userID {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваша заявка")
		return nil, false
	}
	return request, true
}

// Update handles PATCH /api/requests/:id (owner only).
func (h *RequestsHandler) Update(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	if _, ok := h.loadOwnedRequest(c, userID, id); !ok {
		return
	}

	var req updateRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей")
		return
	}

	// Every buyer request is an Auto Exchange participant (there is no
	// non-exchange buyer request, unlike listings' IsExchange flag) — its
	// offer moves only via the daily +1% engine
	// (ExchangeService.growBuyerOffers). A direct edit here would let the
	// buyer bypass that mechanic entirely.
	if req.CurrentOffer != nil {
		respondError(c, http.StatusConflict, "EXCHANGE_MANAGED_FIELD", "Предложение управляется автообменом и не может быть изменено вручную")
		return
	}

	if !validLocation(c, h.locations, req.RegionID, req.CityID, req.DistrictID) {
		return
	}
	if derived, ok, err := resolveLocationText(c.Request.Context(), h.locations, req.RegionID, req.CityID); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить заявку")
		return
	} else if ok {
		req.Region = &derived
	}

	fields := map[string]any{}
	if req.Region != nil {
		fields["region"] = *req.Region
	}
	// The location trio is replaced as a whole whenever regionId is sent —
	// never a partial patch of just one of the three — so a region change
	// can't leave a stale city/district behind, and a city change can't
	// leave a stale district behind. A PATCH that omits regionId entirely
	// (e.g. one that only ever touches other fields) never reaches this
	// block, so it can't accidentally clear an existing location.
	if req.RegionID != nil {
		fields["region_id"] = *req.RegionID
		if req.CityID != nil {
			fields["city_id"] = *req.CityID
		} else {
			fields["city_id"] = nil
		}
		if req.DistrictID != nil {
			fields["district_id"] = *req.DistrictID
		} else {
			fields["district_id"] = nil
		}
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

// Cancel handles DELETE /api/requests/:id (owner only) — a soft delete,
// mirroring ListingsHandler.Archive: status becomes "archived", the row
// is kept. Previously no way to remove a buyer request existed at all.
func (h *RequestsHandler) Cancel(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	if _, ok := h.loadOwnedRequest(c, userID, id); !ok {
		return
	}

	if err := h.requests.SetStatus(c.Request.Context(), id, "archived"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось отменить заявку")
		return
	}

	c.Status(http.StatusNoContent)
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
