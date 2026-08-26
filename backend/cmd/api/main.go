package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"avtobirzhasi/backend/internal/config"
	"avtobirzhasi/backend/internal/db"
	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// HTTP server timeouts — the zero-value http.Server gin.Run() would
// otherwise use has none of these, which is a known production risk
// (a slow/stalled client can hold a connection open indefinitely).
const (
	readHeaderTimeout = 5 * time.Second
	readTimeout       = 15 * time.Second
	writeTimeout      = 30 * time.Second
	idleTimeout       = 60 * time.Second
	shutdownTimeout   = 15 * time.Second
)

func main() {
	cfg := config.Load()

	// Cancelled on SIGINT/SIGTERM — both the HTTP server's shutdown wait
	// below and the daily-tick scheduler goroutine derive from this same
	// context, so a container stop/restart drains in-flight work instead
	// of hard-killing it.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
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
	// MockPaymentProvider is the only PaymentProvider implemented today —
	// see service/payment.go's doc comment. Swapping in a real gateway
	// later only changes this one line.
	depositService := service.NewDepositService(pool, service.NewMockPaymentProvider())

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
	adminListingsHandler := handlers.NewAdminListingsHandler(listingRepo, userRepo)
	adminRequestsHandler := handlers.NewAdminRequestsHandler(buyerRequestRepo, userRepo)
	adminMatchesHandler := handlers.NewAdminMatchesHandler(matchRepo)
	adminDepositsHandler := handlers.NewAdminDepositsHandler(depositRepo)
	adminUsersHandler := handlers.NewAdminUsersHandler(userRepo)

	router := gin.Default()
	router.Use(middleware.CORS())

	api := router.Group("/api")
	handlers.RegisterHealthRoutes(api, pool)
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

	// Admin-facing product features (moderation, stats, and the Stage 10
	// monitoring views) live under /api/admin — reachable over the public
	// internet like any other /api route, gated by Auth + AdminOnly (a
	// real users.role='admin' account, checked fresh from the DB every
	// request — see middleware/admin.go). This is deliberately NOT under
	// LocalOnly: that network-position check makes sense for a genuinely
	// internal debug trigger (see the /internal group below), but an
	// admin's own browser calling these from a normal page load is not a
	// "local" caller — mounting these under LocalOnly made them
	// unreachable from any real browser session, confirmed live against
	// production before this stage (see STAGE10_ADMIN_COMPLETION_REPORT.md).
	adminAPI := router.Group("/api/admin",
		middleware.Auth(cfg.JWTSecret),
		middleware.AdminOnly(userRepo),
	)
	handlers.RegisterModerationRoutes(adminAPI, moderationHandler)
	handlers.RegisterAdminStatsRoutes(adminAPI, adminStatsHandler)
	handlers.RegisterAdminListingsRoutes(adminAPI, adminListingsHandler)
	handlers.RegisterAdminRequestsRoutes(adminAPI, adminRequestsHandler)
	handlers.RegisterAdminMatchesRoutes(adminAPI, adminMatchesHandler)
	handlers.RegisterAdminDepositsRoutes(adminAPI, adminDepositsHandler)
	handlers.RegisterAdminUsersRoutes(adminAPI, adminUsersHandler)

	// /internal stays LocalOnly-gated (plus Auth + AdminOnly, belt and
	// suspenders) — this is for the one genuinely internal, non-UI-facing
	// endpoint: the manual daily-tick trigger, which must never be
	// reachable from the public internet at all, by design.
	internal := router.Group("/internal",
		middleware.LocalOnly(),
		middleware.Auth(cfg.JWTSecret),
		middleware.AdminOnly(userRepo),
	)
	handlers.RegisterJobsRoutes(internal, jobsHandler)

	go runDailyTickScheduler(ctx, exchangeService)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: readHeaderTimeout,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}

	go func() {
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server failed: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutdown signal received, draining in-flight requests")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown did not complete cleanly: %v", err)
	} else {
		log.Println("server shut down cleanly")
	}
}

// runDailyTickScheduler runs the Auto Exchange engine once every 24 hours
// for the lifetime of the process, stopping when ctx is cancelled (the
// same signal-derived context the HTTP server shuts down on) instead of
// being killed mid-tick. Not distributed-safe (fine for a single-instance
// MVP — see SKILL.md's Auto Exchange engine section); use
// POST /internal/jobs/run-daily-tick to trigger a pass on demand instead of
// waiting for real time to pass.
func runDailyTickScheduler(ctx context.Context, exchange *service.ExchangeService) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("daily tick scheduler stopping")
			return
		case <-ticker.C:
			runTickSafely(ctx, exchange)
		}
	}
}

// runTickSafely recovers a panic from inside RunDailyTick and logs it
// instead of letting it crash the whole process. A panic inside an HTTP
// handler is already caught by gin's own Recovery middleware, but this
// background goroutine has no such net by default.
func runTickSafely(ctx context.Context, exchange *service.ExchangeService) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("daily tick panicked (recovered): %v", r)
		}
	}()

	result, err := exchange.RunDailyTick(ctx)
	if err != nil {
		log.Printf("scheduled daily tick failed: %v", err)
		return
	}
	log.Printf("scheduled daily tick: %+v", result)
}
