package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// AuthHandler wires the /api/auth/* routes to AuthService.
type AuthHandler struct {
	auth *service.AuthService
}

// NewAuthHandler creates an AuthHandler.
func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

// RegisterAuthRoutes wires /auth/register, /auth/login and /auth/me (the
// last one behind the JWT middleware).
func RegisterAuthRoutes(router *gin.RouterGroup, h *AuthHandler, jwtSecret string) {
	auth := router.Group("/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)
	auth.GET("/me", middleware.Auth(jwtSecret), h.Me)
}

type registerRequest struct {
	Name     string `json:"name" binding:"required"`
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей")
		return
	}

	user, token, err := h.auth.Register(c.Request.Context(), req.Name, req.Phone, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidPhone):
			respondError(c, http.StatusBadRequest, "INVALID_PHONE",
				"Введите номер в формате +7 707 123 45 67 или 8 707 123 45 67")
		case errors.Is(err, service.ErrPhoneTaken):
			respondError(c, http.StatusConflict, "PHONE_TAKEN", "Этот номер телефона уже зарегистрирован")
		default:
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось создать аккаунт, попробуйте позже")
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{"token": token, "user": toUserResponse(user)})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей")
		return
	}

	user, token, err := h.auth.Login(c.Request.Context(), req.Phone, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidPhone):
			respondError(c, http.StatusBadRequest, "INVALID_PHONE",
				"Введите номер в формате +7 707 123 45 67 или 8 707 123 45 67")
		default:
			respondError(c, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Неверный телефон или пароль")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "user": toUserResponse(user)})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, ok := middleware.UserID(c)
	if !ok {
		respondError(c, http.StatusUnauthorized, "UNAUTHORIZED", "Требуется авторизация")
		return
	}

	user, err := h.auth.GetUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Пользователь не найден")
		return
	}

	c.JSON(http.StatusOK, toUserResponse(user))
}
