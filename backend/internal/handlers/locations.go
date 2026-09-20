package handlers

import (
	"net/http"

	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// LocationsHandler wires the public regions/cities/districts reference
// routes — read-only, unauthenticated, the same policy as CarsHandler.
// Backs the region -> city -> district cascade a listing/request form
// will use; see docs/LOCATION_IMPLEMENTATION.md Stage 4.
type LocationsHandler struct {
	locations *repository.LocationRepository
}

// NewLocationsHandler creates a LocationsHandler.
func NewLocationsHandler(locations *repository.LocationRepository) *LocationsHandler {
	return &LocationsHandler{locations: locations}
}

// RegisterLocationsRoutes wires the public location-reference routes.
// None of these require authentication (same policy as
// RegisterCarsRoutes). A republican-significance region (Astana/Almaty/
// Shymkent) has exactly one city row — see ListCitiesByRegion — so its
// districts are already reachable through GET /api/cities/:id/districts;
// no separate /api/regions/:id/districts route is needed.
func RegisterLocationsRoutes(router *gin.RouterGroup, h *LocationsHandler) {
	router.GET("/regions", h.ListRegions)
	router.GET("/regions/:id/cities", h.ListCities)
	router.GET("/cities/:id/districts", h.ListDistricts)
}

type regionResponse struct {
	ID        string `json:"id"`
	NameRU    string `json:"nameRu"`
	NameKZ    string `json:"nameKz"`
	Kind      string `json:"kind"`
	IsSpecial bool   `json:"isSpecial"`
}

func toRegionResponse(r models.Region) regionResponse {
	return regionResponse{
		ID:     r.ID,
		NameRU: r.NameRU,
		NameKZ: r.NameKZ,
		Kind:   r.Kind,
		// A region of republican significance IS the city (Astana/
		// Almaty/Shymkent) — computed from kind, not a separate column.
		IsSpecial: r.Kind == "republican_city",
	}
}

type cityResponse struct {
	ID       string `json:"id"`
	RegionID string `json:"regionId"`
	NameRU   string `json:"nameRu"`
	NameKZ   string `json:"nameKz"`
}

func toCityResponse(city models.City) cityResponse {
	return cityResponse{ID: city.ID, RegionID: city.RegionID, NameRU: city.NameRU, NameKZ: city.NameKZ}
}

type districtResponse struct {
	ID       string  `json:"id"`
	Kind     string  `json:"kind"`
	CityID   *string `json:"cityId,omitempty"`
	RegionID *string `json:"regionId,omitempty"`
	NameRU   string  `json:"nameRu"`
	NameKZ   string  `json:"nameKz"`
}

func toDistrictResponse(d models.District) districtResponse {
	return districtResponse{
		ID: d.ID, Kind: d.Kind, CityID: d.CityID, RegionID: d.RegionID,
		NameRU: d.NameRU, NameKZ: d.NameKZ,
	}
}

// ListRegions handles GET /api/regions — every region, oblast or
// republican-significance city alike, alphabetically by Russian name.
func (h *LocationsHandler) ListRegions(c *gin.Context) {
	regions, err := h.locations.ListRegions(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить список регионов")
		return
	}
	out := make([]regionResponse, len(regions))
	for i, r := range regions {
		out[i] = toRegionResponse(r)
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

// ListCities handles GET /api/regions/:id/cities — only the cities of
// the given region. 404 if the region itself doesn't exist; an empty
// "items" array (not an error) if it exists but has no cities.
func (h *LocationsHandler) ListCities(c *gin.Context) {
	regionID, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	exists, err := h.locations.RegionExists(c.Request.Context(), regionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить регион")
		return
	}
	if !exists {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Регион не найден")
		return
	}

	cities, err := h.locations.ListCitiesByRegion(c.Request.Context(), regionID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить города")
		return
	}
	out := make([]cityResponse, len(cities))
	for i, city := range cities {
		out[i] = toCityResponse(city)
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

// ListDistricts handles GET /api/cities/:id/districts — only the urban
// districts of the given city. This also serves Astana/Almaty/Shymkent
// (each modeled as one city row under its republican-significance
// region). 404 if the city itself doesn't exist; an empty "items" array
// if it exists but has no districts (true for every city except those
// three today — see docs/LOCATION_IMPLEMENTATION.md Stage 3B).
func (h *LocationsHandler) ListDistricts(c *gin.Context) {
	cityID, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	exists, err := h.locations.CityExists(c.Request.Context(), cityID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить город")
		return
	}
	if !exists {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Город не найден")
		return
	}

	districts, err := h.locations.ListDistrictsByCity(c.Request.Context(), cityID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить районы")
		return
	}
	out := make([]districtResponse, len(districts))
	for i, d := range districts {
		out[i] = toDistrictResponse(d)
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}
