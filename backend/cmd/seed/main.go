// Command seed loads the same 20 fixtures used by the frontend's mock data
// (frontend/lib/mock/cars.ts, sellers.ts) into the real database, so the
// public catalog looks identical whether it's reading mocks or the API.
//
// Idempotent: it deletes its own seed rows (matched by phone/name) before
// re-inserting, so it's safe to run repeatedly against a dev database. It
// does not touch any other data.
package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"avtobirzhasi/backend/internal/config"
	"avtobirzhasi/backend/internal/db"

	"golang.org/x/crypto/bcrypt"
)

type seedSeller struct {
	name         string
	phone        string
	accountType  string
	since        int
	rating       float64
	reviewsCount int
}

// Matches frontend/lib/mock/sellers.ts exactly.
var sellers = []seedSeller{
	{"Данияр К.", "+77071234567", "private", 2023, 4.8, 12},
	{"Auto Plus Almaty", "+77275551234", "dealer", 2019, 4.9, 236},
	{"Марат С.", "+77019876543", "private", 2022, 4.6, 5},
	{"Astana Motors Trade", "+77172223344", "dealer", 2016, 4.7, 512},
	{"Ержан Т.", "+77054567890", "private", 2024, 5.0, 2},
	{"Shymkent Auto Hub", "+77253332211", "dealer", 2020, 4.5, 143},
}

// image letter -> Unsplash photo id, matches frontend/lib/mock/cars.ts.
var imageIDs = map[string]string{
	"a": "1503376780353-7e6692767b70",
	"b": "1552519507-da3b142c6e3d",
	"c": "1533473359331-0135ef1b58bf",
	"d": "1553440569-bcc63803a83d",
	"e": "1605559424843-9e4c228bf1c2",
	"f": "1580273916550-e323be2ae537",
	"g": "1618843479313-40f8afb4b4d8",
	"h": "1511919884226-fd3cad34687c",
	"i": "1494905998402-395d579af36f",
	"j": "1571607388263-1044f9ea01dd",
	"k": "1542362567-b07e54358753",
	"l": "1583121274602-3e2820c69888",
}

func img(letter string) string {
	return fmt.Sprintf("https://images.unsplash.com/photo-%s?auto=format&fit=crop&w=1200&q=80", imageIDs[letter])
}

type seedListing struct {
	make, model            string
	year                   int
	price                  int64
	mileageKm              int
	region                 string
	transmission, fuelType string
	bodyType, drivetrain   string
	engineVolume           float64
	enginePower            int
	color                  string
	images                 []string // letters, position 0 is the primary photo
	sellerIndex            int      // 0-based index into sellers
	isExchange             bool
}

// Matches frontend/lib/mock/cars.ts's 20 fixtures (make/model/specs/price/
// region/seller assignment/isExchange) exactly. Gallery letter sets are
// pre-computed from that file's galleryFor() so the seeded photos match
// what the frontend mock shows for the same car.
var listings = []seedListing{
	{"Toyota", "Camry", 2022, 14_200_000, 32000, "Алматы", "automatic", "petrol", "sedan", "fwd", 2.5, 181, "Белый", []string{"a", "d", "g", "j"}, 0, false},
	{"Hyundai", "Tucson", 2021, 11_800_000, 41500, "Астана", "automatic", "petrol", "crossover", "awd", 2.0, 156, "Синий", []string{"b", "f", "i", "l"}, 1, true},
	{"Toyota", "Land Cruiser Prado", 2020, 24_500_000, 58000, "Шымкент", "automatic", "diesel", "suv", "awd", 2.8, 177, "Чёрный", []string{"c", "h", "k", "b"}, 2, false},
	{"Kia", "Rio", 2023, 8_300_000, 12000, "Караганда", "automatic", "petrol", "hatchback", "fwd", 1.6, 123, "Красный", []string{"d", "j", "a", "d"}, 3, true},
	{"BMW", "X5", 2019, 21_900_000, 71000, "Алматы", "automatic", "diesel", "suv", "awd", 3.0, 249, "Серый", []string{"e", "l", "c", "f"}, 4, false},
	{"Volkswagen", "Tiguan", 2021, 12_700_000, 39000, "Актобе", "automatic", "petrol", "crossover", "awd", 2.0, 180, "Серебристый", []string{"f", "b", "e", "h"}, 5, false},
	{"Mercedes-Benz", "E-Class", 2020, 19_500_000, 54000, "Астана", "automatic", "petrol", "sedan", "rwd", 2.0, 197, "Чёрный", []string{"g", "d", "g", "j"}, 0, true},
	{"Chevrolet", "Cobalt", 2022, 6_900_000, 21000, "Павлодар", "manual", "petrol", "sedan", "fwd", 1.5, 106, "Белый", []string{"h", "f", "i", "l"}, 1, false},
	{"Lada", "Vesta", 2023, 5_400_000, 8000, "Алматы", "manual", "petrol", "sedan", "fwd", 1.6, 106, "Синий", []string{"i", "h", "k", "b"}, 2, false},
	{"Kia", "Sportage", 2022, 14_900_000, 25000, "Астана", "automatic", "petrol", "crossover", "awd", 2.0, 150, "Коричневый", []string{"j", "j", "a", "d"}, 3, false},
	{"Hyundai", "Elantra", 2021, 9_600_000, 46000, "Шымкент", "automatic", "petrol", "sedan", "fwd", 1.6, 123, "Серебристый", []string{"k", "l", "c", "f"}, 4, false},
	{"Toyota", "RAV4", 2022, 17_300_000, 28000, "Алматы", "automatic", "hybrid", "suv", "awd", 2.5, 218, "Белый", []string{"l", "b", "e", "h"}, 5, true},
	{"Skoda", "Octavia", 2020, 10_200_000, 62000, "Караганда", "automatic", "diesel", "universal", "fwd", 2.0, 150, "Серый", []string{"a", "d", "g", "j"}, 0, false},
	{"BMW", "5-Series", 2021, 23_400_000, 44000, "Астана", "automatic", "petrol", "sedan", "rwd", 2.0, 190, "Чёрный", []string{"b", "f", "i", "l"}, 1, true},
	{"Mercedes-Benz", "GLE", 2021, 28_700_000, 39000, "Алматы", "automatic", "diesel", "suv", "awd", 3.0, 249, "Серебристый", []string{"c", "h", "k", "b"}, 2, false},
	{"Chevrolet", "Spark", 2023, 5_900_000, 15000, "Атырау", "manual", "petrol", "hatchback", "fwd", 1.2, 82, "Красный", []string{"d", "j", "a", "d"}, 3, false},
	{"Lexus", "RX", 2020, 26_800_000, 51000, "Астана", "automatic", "petrol", "crossover", "awd", 3.5, 295, "Белый", []string{"e", "l", "c", "f"}, 4, false},
	{"Volkswagen", "Polo", 2022, 8_700_000, 19000, "Усть-Каменогорск", "automatic", "petrol", "sedan", "fwd", 1.6, 110, "Синий", []string{"f", "b", "e", "h"}, 5, false},
	{"Kia", "K5", 2023, 13_500_000, 11000, "Алматы", "automatic", "petrol", "sedan", "fwd", 1.6, 194, "Чёрный", []string{"g", "d", "g", "j"}, 0, true},
	{"Hyundai", "Solaris", 2021, 7_600_000, 37000, "Шымкент", "automatic", "petrol", "sedan", "fwd", 1.6, 123, "Серебристый", []string{"h", "f", "i", "l"}, 1, false},
}

var transmissionRu = map[string]string{"automatic": "автомат", "manual": "механика"}
var drivetrainRu = map[string]string{"fwd": "передний", "rwd": "задний", "awd": "полный"}

func description(l seedListing) string {
	return fmt.Sprintf(
		"%s %s %d года в хорошем состоянии. Пробег %d км, коробка передач — %s, привод — %s. "+
			"Кузов не крашен, все технические жидкости заменены по регламенту. Автомобиль готов к "+
			"эксплуатации, возможен торг при осмотре.",
		l.make, l.model, l.year, l.mileageKm, transmissionRu[l.transmission], drivetrainRu[l.drivetrain],
	)
}

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	phones := make([]string, len(sellers))
	for i, s := range sellers {
		phones[i] = s.phone
	}

	// Idempotent: remove this seed's own rows first, without touching
	// anything else. listings.user_id has no ON DELETE CASCADE (a real
	// user's listings must never silently disappear), so listings (and,
	// via cascade, their listing_images) must be deleted before the users
	// that own them.
	if _, err := pool.Exec(ctx, `
		DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))
	`, phones); err != nil {
		log.Fatalf("cleanup listings before seed: %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM users WHERE phone = ANY($1)`, phones); err != nil {
		log.Fatalf("cleanup users before seed: %v", err)
	}

	sellerIDs := make([]string, len(sellers))
	placeholderHash, err := bcrypt.GenerateFromPassword([]byte("seed-account-not-for-login"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash seed password: %v", err)
	}

	for i, s := range sellers {
		createdAt := time.Date(s.since, time.January, 1, 0, 0, 0, 0, time.UTC)
		err := pool.QueryRow(ctx, `
			INSERT INTO users (name, phone, password_hash, account_type, rating, reviews_count, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
			RETURNING id
		`, s.name, s.phone, string(placeholderHash), s.accountType, s.rating, s.reviewsCount, createdAt).Scan(&sellerIDs[i])
		if err != nil {
			log.Fatalf("seed seller %s: %v", s.name, err)
		}
	}
	log.Printf("seeded %d sellers", len(sellers))

	for _, l := range listings {
		userID := sellerIDs[l.sellerIndex]
		desc := description(l)

		var initialPrice *int64
		var exchangeStartedAt *time.Time
		if l.isExchange {
			price := l.price
			initialPrice = &price
			now := time.Now()
			exchangeStartedAt = &now
		}

		var listingID string
		err := pool.QueryRow(ctx, `
			INSERT INTO listings (
				user_id, make, model, year, price, mileage_km, region, transmission,
				fuel_type, body_type, drivetrain, engine_volume, engine_power, color,
				steering_wheel, description, status, is_exchange, initial_price, exchange_started_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'left',$15,'active',$16,$17,$18)
			RETURNING id
		`,
			userID, l.make, l.model, l.year, l.price, l.mileageKm, l.region, l.transmission,
			l.fuelType, l.bodyType, l.drivetrain, l.engineVolume, l.enginePower, l.color,
			desc, l.isExchange, initialPrice, exchangeStartedAt,
		).Scan(&listingID)
		if err != nil {
			log.Fatalf("seed listing %s %s: %v", l.make, l.model, err)
		}

		for position, letter := range l.images {
			if _, err := pool.Exec(ctx,
				`INSERT INTO listing_images (listing_id, url, position) VALUES ($1, $2, $3)`,
				listingID, img(letter), position,
			); err != nil {
				log.Fatalf("seed image for %s %s: %v", l.make, l.model, err)
			}
		}
	}
	log.Printf("seeded %d listings", len(listings))
	log.Println(strings.Repeat("-", 40))
	log.Println("done")
}
