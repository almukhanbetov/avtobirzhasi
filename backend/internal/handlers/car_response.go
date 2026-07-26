package handlers

import (
	"time"

	"avtobirzhasi/backend/internal/models"
)

// carResponse mirrors frontend/types/car.ts's Car type field-for-field
// (camelCase JSON) so lib/api/* clients can be thin passthroughs.
type carResponse struct {
	ID                 string   `json:"id"`
	Make               string   `json:"make"`
	Model              string   `json:"model"`
	Year               int      `json:"year"`
	Price              int64    `json:"price"`
	MileageKm          int      `json:"mileageKm"`
	Region             string   `json:"region"`
	Transmission       string   `json:"transmission"`
	FuelType           string   `json:"fuelType"`
	BodyType           string   `json:"bodyType"`
	Drivetrain         string   `json:"drivetrain"`
	EngineVolume       float64  `json:"engineVolume"`
	EnginePower        int      `json:"enginePower"`
	Color              string   `json:"color"`
	SteeringWheel      string   `json:"steeringWheel"`
	ImageURL           string   `json:"imageUrl"`
	Images             []string `json:"images"`
	SellerID           string   `json:"sellerId"`
	Description        string   `json:"description,omitempty"`
	IsExchange         bool     `json:"isExchange,omitempty"`
	ExchangeRole       string   `json:"exchangeRole,omitempty"`
	DailyChangePercent int      `json:"dailyChangePercent,omitempty"`
}

func toCarResponse(l models.Listing) carResponse {
	resp := carResponse{
		ID:            l.ID,
		Make:          l.Make,
		Model:         l.Model,
		Year:          l.Year,
		Price:         l.Price,
		MileageKm:     l.MileageKm,
		Region:        l.Region,
		Transmission:  l.Transmission,
		FuelType:      l.FuelType,
		BodyType:      l.BodyType,
		Drivetrain:    l.Drivetrain,
		EngineVolume:  l.EngineVolume,
		EnginePower:   l.EnginePower,
		Color:         l.Color,
		SteeringWheel: l.SteeringWheel,
		Images:        l.Images,
		SellerID:      l.UserID,
		IsExchange:    l.IsExchange,
	}
	if len(l.Images) > 0 {
		resp.ImageURL = l.Images[0]
	}
	if l.Description != nil {
		resp.Description = *l.Description
	}
	if l.IsExchange {
		// A listing is always the seller side of an Auto Exchange
		// participation — see models.Listing's doc comment.
		resp.ExchangeRole = "seller"
		resp.DailyChangePercent = -1
	}
	return resp
}

func toCarResponses(listings []models.Listing) []carResponse {
	out := make([]carResponse, len(listings))
	for i, l := range listings {
		out[i] = toCarResponse(l)
	}
	return out
}

// sellerListingResponse mirrors the frontend's SellerListing type
// (frontend/types/dashboard.ts) — id is the same as car.id (a listing IS
// the car, there is no separate wrapper entity in this schema), kept as
// its own field only to match the frontend's nested shape.
type sellerListingResponse struct {
	ID        string      `json:"id"`
	Car       carResponse `json:"car"`
	Status    string      `json:"status"`
	UpdatedAt string      `json:"updatedAt"`
}

func toSellerListingResponse(l models.Listing) sellerListingResponse {
	return sellerListingResponse{
		ID:        l.ID,
		Car:       toCarResponse(l),
		Status:    l.Status,
		UpdatedAt: l.UpdatedAt.Format(time.RFC3339),
	}
}
