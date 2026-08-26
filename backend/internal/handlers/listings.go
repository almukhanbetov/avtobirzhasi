package handlers

import (
	"errors"
	"net/http"
	"time"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// ListingsHandler wires the authenticated /api/listings and
// /api/dashboard/listings routes.
type ListingsHandler struct {
	listings *repository.ListingRepository
}

// NewListingsHandler creates a ListingsHandler.
func NewListingsHandler(listings *repository.ListingRepository) *ListingsHandler {
	return &ListingsHandler{listings: listings}
}

// RegisterListingsWriteRoutes wires the seller-facing listing management
// routes, all behind the JWT middleware.
func RegisterListingsWriteRoutes(router *gin.RouterGroup, h *ListingsHandler, jwtSecret string) {
	router.POST("/listings", middleware.Auth(jwtSecret), h.Create)
	router.PATCH("/listings/:id", middleware.Auth(jwtSecret), h.Update)
	router.DELETE("/listings/:id", middleware.Auth(jwtSecret), h.Archive)
	router.GET("/dashboard/listings", middleware.Auth(jwtSecret), h.ListMine)
}

type createListingRequest struct {
	Make          string   `json:"make" binding:"required"`
	Model         string   `json:"model" binding:"required"`
	Year          int      `json:"year" binding:"required"`
	Price         int64    `json:"price" binding:"required,min=1"`
	MileageKm     int      `json:"mileageKm"`
	Region        string   `json:"region" binding:"required"`
	Transmission  string   `json:"transmission" binding:"required,oneof=automatic manual"`
	FuelType      string   `json:"fuelType" binding:"required,oneof=petrol diesel hybrid electric gas"`
	BodyType      string   `json:"bodyType" binding:"required,oneof=sedan suv crossover hatchback coupe universal"`
	Drivetrain    string   `json:"drivetrain" binding:"required,oneof=fwd rwd awd"`
	EngineVolume  float64  `json:"engineVolume" binding:"required"`
	EnginePower   int      `json:"enginePower" binding:"required"`
	Color         string   `json:"color" binding:"required"`
	SteeringWheel string   `json:"steeringWheel" binding:"omitempty,oneof=left right"`
	Description   string   `json:"description"`
	Images        []string `json:"images" binding:"required,min=1"`
	IsExchange    bool     `json:"isExchange"`
}

// Create handles POST /api/listings. New listings always start in
// "moderation" — see SKILL.md.
func (h *ListingsHandler) Create(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	var req createListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей объявления")
		return
	}

	steeringWheel := req.SteeringWheel
	if steeringWheel == "" {
		steeringWheel = "left"
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	listing := &models.Listing{
		UserID:        userID,
		Make:          req.Make,
		Model:         req.Model,
		Year:          req.Year,
		Price:         req.Price,
		MileageKm:     req.MileageKm,
		Region:        req.Region,
		Transmission:  req.Transmission,
		FuelType:      req.FuelType,
		BodyType:      req.BodyType,
		Drivetrain:    req.Drivetrain,
		EngineVolume:  req.EngineVolume,
		EnginePower:   req.EnginePower,
		Color:         req.Color,
		SteeringWheel: steeringWheel,
		Description:   description,
		Status:        "moderation",
		IsExchange:    req.IsExchange,
	}
	if req.IsExchange {
		// A listing declared as Auto Exchange at creation starts its
		// participation right away — see the Exchange engine's decay
		// query (only status='active' listings move, so nothing happens
		// until moderation approves it, but the starting price/timestamp
		// are recorded from the moment the seller opted in).
		startedAt := time.Now()
		listing.InitialPrice = &req.Price
		listing.ExchangeStartedAt = &startedAt
	}

	if err := h.listings.Create(c.Request.Context(), listing); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось создать объявление, попробуйте позже")
		return
	}

	for i, url := range req.Images {
		if err := h.listings.AddImage(c.Request.Context(), listing.ID, url, i); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фотографии")
			return
		}
	}
	listing.Images = req.Images

	c.JSON(http.StatusCreated, toCarResponse(*listing))
}

type updateListingRequest struct {
	Price       *int64  `json:"price" binding:"omitempty,min=1"`
	MileageKm   *int    `json:"mileageKm" binding:"omitempty,min=0"`
	Description *string `json:"description"`
	Region      *string `json:"region" binding:"omitempty,min=1"`
	Color       *string `json:"color" binding:"omitempty,min=1"`
}

// loadOwnedListing loads a listing and verifies the authenticated user
// owns it, writing the appropriate error response and returning ok=false
// if not.
func (h *ListingsHandler) loadOwnedListing(c *gin.Context, userID, id string) (*models.Listing, bool) {
	listing, err := h.listings.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Объявление не найдено")
		return nil, false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявление")
		return nil, false
	}
	if listing.UserID != userID {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваше объявление")
		return nil, false
	}
	return listing, true
}

// Update handles PATCH /api/listings/:id (owner only). Only the fields a
// seller would realistically edit post-creation are exposed — changing
// make/model/year/engine specs is treated as "list a new car" instead.
func (h *ListingsHandler) Update(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	listing, ok := h.loadOwnedListing(c, userID, id)
	if !ok {
		return
	}

	var req updateListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей")
		return
	}

	// Auto Exchange listings move only via the daily ±1% engine
	// (ExchangeService.decayListingPrices) — direct price edits here would
	// let the owner bypass the fairness mechanic entirely (force an
	// instant match, or freeze the price after an expiry resumes it).
	if req.Price != nil && listing.IsExchange {
		respondError(c, http.StatusConflict, "EXCHANGE_MANAGED_FIELD", "Цена управляется автообменом и не может быть изменена вручную")
		return
	}

	fields := map[string]any{}
	if req.Price != nil {
		fields["price"] = *req.Price
	}
	if req.MileageKm != nil {
		fields["mileage_km"] = *req.MileageKm
	}
	if req.Description != nil {
		fields["description"] = *req.Description
	}
	if req.Region != nil {
		fields["region"] = *req.Region
	}
	if req.Color != nil {
		fields["color"] = *req.Color
	}

	if len(fields) > 0 {
		if err := h.listings.Update(c.Request.Context(), id, fields); err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить объявление")
			return
		}
	}

	updated, err := h.listings.GetByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить объявление")
		return
	}

	c.JSON(http.StatusOK, toCarResponse(*updated))
}

// Archive handles DELETE /api/listings/:id (owner only) — a soft delete,
// per SKILL.md: status becomes "archived", the row is kept.
func (h *ListingsHandler) Archive(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	if _, ok := h.loadOwnedListing(c, userID, id); !ok {
		return
	}

	if err := h.listings.SetStatus(c.Request.Context(), id, "archived"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось удалить объявление")
		return
	}

	c.Status(http.StatusNoContent)
}

// ListMine handles GET /api/dashboard/listings — the authenticated user's
// own listings, any status.
func (h *ListingsHandler) ListMine(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	items, err := h.listings.ListByUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявления")
		return
	}

	out := make([]sellerListingResponse, len(items))
	for i, l := range items {
		out[i] = toSellerListingResponse(l)
	}

	c.JSON(http.StatusOK, out)
}
