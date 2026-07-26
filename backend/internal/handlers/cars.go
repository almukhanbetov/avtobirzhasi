package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// CarsHandler wires the public /api/cars routes to ListingRepository.
type CarsHandler struct {
	listings *repository.ListingRepository
}

// NewCarsHandler creates a CarsHandler.
func NewCarsHandler(listings *repository.ListingRepository) *CarsHandler {
	return &CarsHandler{listings: listings}
}

// RegisterCarsRoutes wires the public catalog routes. None of these
// require authentication.
func RegisterCarsRoutes(router *gin.RouterGroup, h *CarsHandler) {
	router.GET("/cars", h.List)
	router.GET("/cars/:id", h.Get)
	router.GET("/cars/:id/similar", h.Similar)
}

func parseIntPtr(raw string) *int {
	if raw == "" {
		return nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil
	}
	return &value
}

func parseInt64Ptr(raw string) *int64 {
	if raw == "" {
		return nil
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}
	return &value
}

// List handles GET /api/cars. Query params match
// frontend/features/listings/filterCars.ts's CarFilters exactly: region,
// make, model, yearFrom, yearTo, priceFrom, priceTo, bodyType,
// transmission, drivetrain, fuelType, sort, page.
func (h *CarsHandler) List(c *gin.Context) {
	const pageSize = 8
	page, _ := strconv.Atoi(c.Query("page"))

	filters := repository.ListingFilters{
		Region:       c.Query("region"),
		Make:         c.Query("make"),
		Model:        c.Query("model"),
		YearFrom:     parseIntPtr(c.Query("yearFrom")),
		YearTo:       parseIntPtr(c.Query("yearTo")),
		PriceFrom:    parseInt64Ptr(c.Query("priceFrom")),
		PriceTo:      parseInt64Ptr(c.Query("priceTo")),
		BodyType:     c.Query("bodyType"),
		Transmission: c.Query("transmission"),
		Drivetrain:   c.Query("drivetrain"),
		FuelType:     c.Query("fuelType"),
		Sort:         c.DefaultQuery("sort", "newest"),
		Page:         page,
		PageSize:     pageSize,
	}

	items, total, err := h.listings.List(c.Request.Context(), filters)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить каталог, попробуйте позже")
		return
	}

	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}
	currentPage := filters.Page
	if currentPage < 1 {
		currentPage = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      toCarResponses(items),
		"total":      total,
		"totalPages": totalPages,
		"page":       currentPage,
	})
}

// Get handles GET /api/cars/:id. Non-active listings are treated as not
// found for this unauthenticated public endpoint — moderation/frozen/
// archived listings are not guessable by id from the public site.
func (h *CarsHandler) Get(c *gin.Context) {
	listing, err := h.listings.GetByID(c.Request.Context(), c.Param("id"))
	if errors.Is(err, repository.ErrNotFound) || (err == nil && listing.Status != "active") {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Автомобиль не найден")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить автомобиль, попробуйте позже")
		return
	}

	c.JSON(http.StatusOK, toCarResponse(*listing))
}

// Similar handles GET /api/cars/:id/similar — up to 4 other active
// listings sharing the same body type or make.
func (h *CarsHandler) Similar(c *gin.Context) {
	listing, err := h.listings.GetByID(c.Request.Context(), c.Param("id"))
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Автомобиль не найден")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить похожие автомобили")
		return
	}

	similar, err := h.listings.Similar(c.Request.Context(), listing, 4)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить похожие автомобили")
		return
	}

	c.JSON(http.StatusOK, toCarResponses(similar))
}
