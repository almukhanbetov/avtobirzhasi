// Package models contains the Go structs that mirror the database tables
// defined in migrations/. See .claude/skills/backend-skills/SKILL.md for
// the full schema.
package models

import "time"

// User backs both the login/register flow and the frontend's Seller shape
// (lib/mock/sellers.ts) — a user acting as a seller is a Seller.
type User struct {
	ID           string
	Name         string
	Phone        string
	PasswordHash string
	Email        *string
	Region       *string
	AccountType  string
	Rating       float64
	ReviewsCount int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Listing backs the frontend's Car type (frontend/types/car.ts) — a
// concrete car for sale. A listing is always the seller side of an Auto
// Exchange participation; IsExchange never implies a buyer role here (see
// buyer_requests, added Stage 4, for the buyer side).
type Listing struct {
	ID                string
	UserID            string
	Make              string
	Model             string
	Year              int
	Price             int64
	MileageKm         int
	Region            string
	Transmission      string
	FuelType          string
	BodyType          string
	Drivetrain        string
	EngineVolume      float64
	EnginePower       int
	Color             string
	SteeringWheel     string
	Description       *string
	Status            string
	IsExchange        bool
	InitialPrice      *int64
	ExchangeStartedAt *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time

	// Images is populated separately from listing_images, not a column.
	Images []string
}

// BuyerRequest backs the frontend's BuyerRequest type
// (frontend/types/dashboard.ts) — search criteria plus a rising offer, with
// no photographed car (see Listing's doc comment for why the buyer side
// never lives on listings).
type BuyerRequest struct {
	ID           string
	UserID       string
	Make         string
	Model        string
	YearFrom     int
	YearTo       int
	Region       string
	InitialOffer int64
	CurrentOffer int64
	Status       string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Match backs the frontend's MatchDeal type (frontend/types/dashboard.ts).
// Status is a derived state machine from the two *_deposit_paid flags,
// except the terminal "expired"/"cancelled" states, which are set
// explicitly — see SKILL.md's Matches section.
type Match struct {
	ID                 string
	ListingID          string
	BuyerRequestID     string
	FinalPrice         int64
	DepositAmount      int64
	SellerDepositPaid  bool
	BuyerDepositPaid   bool
	Status             string
	Deadline           time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// Deposit backs the frontend's Deposit type (frontend/types/dashboard.ts).
// Each Match gets exactly two rows, one per role, created atomically with
// the match itself.
type Deposit struct {
	ID         string
	MatchID    string
	UserID     string
	Role       string
	Amount     int64
	Status     string
	CreatedAt  time.Time
	PaidAt     *time.Time
	RefundedAt *time.Time
}

// Notification backs the frontend's Notification type
// (frontend/types/dashboard.ts).
type Notification struct {
	ID                string
	UserID            string
	Type              string
	Message           string
	Read              bool
	RelatedMatchID    *string
	RelatedListingID  *string
	CreatedAt         time.Time
}
