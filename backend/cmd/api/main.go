package main

import (
	"context"
	"log"
	"time"

	"avtobirzhasi/backend/internal/config"
	"avtobirzhasi/backend/internal/db"
	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	pool, err := db.NewPool(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()
	log.Println("database connected")

	repo := repository.New(pool)
	userRepo := repository.NewUserRepository(repo)
	listingRepo := repository.NewListingRepository(repo)
	buyerRequestRepo := repository.NewBuyerRequestRepository(repo)
	favoriteRepo := repository.NewFavoriteRepository(repo)
	matchRepo := repository.NewMatchRepository(repo)
	depositRepo := repository.NewDepositRepository(repo)
	notificationRepo := repository.NewNotificationRepository(repo)
	adminRepo := repository.NewAdminRepository(pool)

	authService := service.NewAuthService(userRepo, cfg.JWTSecret)
	exchangeService := service.NewExchangeService(pool)
	depositService := service.NewDepositService(pool)

	authHandler := handlers.NewAuthHandler(authService)
	carsHandler := handlers.NewCarsHandler(listingRepo)
	sellersHandler := handlers.NewSellersHandler(userRepo, listingRepo)
	listingsHandler := handlers.NewListingsHandler(listingRepo)
	requestsHandler := handlers.NewRequestsHandler(buyerRequestRepo)
	favoritesHandler := handlers.NewFavoritesHandler(favoriteRepo, listingRepo)
	matchesHandler := handlers.NewMatchesHandler(matchRepo, listingRepo, userRepo)
	depositsHandler := handlers.NewDepositsHandler(depositRepo, matchRepo, listingRepo, depositService)
	notificationsHandler := handlers.NewNotificationsHandler(notificationRepo)
	dashboardHandler := handlers.NewDashboardHandler(listingRepo, buyerRequestRepo, matchRepo, favoriteRepo, notificationRepo)
	jobsHandler := handlers.NewJobsHandler(exchangeService)
	moderationHandler := handlers.NewModerationHandler(listingRepo, userRepo)
	adminStatsHandler := handlers.NewAdminStatsHandler(adminRepo)

	router := gin.Default()
	router.Use(middleware.CORS())

	api := router.Group("/api")
	handlers.RegisterHealthRoutes(api)
	handlers.RegisterAuthRoutes(api, authHandler, cfg.JWTSecret)
	handlers.RegisterCarsRoutes(api, carsHandler)
	handlers.RegisterSellersRoutes(api, sellersHandler)
	handlers.RegisterListingsWriteRoutes(api, listingsHandler, cfg.JWTSecret)
	handlers.RegisterRequestsRoutes(api, requestsHandler, cfg.JWTSecret)
	handlers.RegisterFavoritesRoutes(api, favoritesHandler, cfg.JWTSecret)
	handlers.RegisterMatchesRoutes(api, matchesHandler, cfg.JWTSecret)
	handlers.RegisterDepositsRoutes(api, depositsHandler, cfg.JWTSecret)
	handlers.RegisterNotificationsRoutes(api, notificationsHandler, cfg.JWTSecret)
	handlers.RegisterDashboardRoutes(api, dashboardHandler, cfg.JWTSecret)

	internal := router.Group("/internal", middleware.LocalOnly())
	handlers.RegisterJobsRoutes(internal, jobsHandler)
	handlers.RegisterModerationRoutes(internal, moderationHandler)
	handlers.RegisterAdminStatsRoutes(internal, adminStatsHandler)

	go runDailyTickScheduler(exchangeService)

	log.Printf("listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}

// runDailyTickScheduler runs the Auto Exchange engine once every 24 hours
// for the lifetime of the process. Not distributed-safe (fine for a
// single-instance MVP — see SKILL.md's Auto Exchange engine section); use
// POST /internal/jobs/run-daily-tick to trigger a pass on demand instead of
// waiting for real time to pass.
func runDailyTickScheduler(exchange *service.ExchangeService) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		result, err := exchange.RunDailyTick(context.Background())
		if err != nil {
			log.Printf("scheduled daily tick failed: %v", err)
			continue
		}
		log.Printf("scheduled daily tick: %+v", result)
	}
}
