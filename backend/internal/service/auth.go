package service

import (
	"context"
	"errors"
	"time"

	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// ErrPhoneTaken is returned by Register when the phone number is already
// associated with an account.
var ErrPhoneTaken = errors.New("phone already registered")

// ErrInvalidCredentials is returned by Login when the phone number is
// well-formed but the account does not exist or the password is wrong. The
// two cases are deliberately not distinguished to avoid leaking which
// accounts exist.
var ErrInvalidCredentials = errors.New("invalid credentials")

const tokenLifetime = 7 * 24 * time.Hour

// AuthService implements registration, login and token verification.
type AuthService struct {
	users     *repository.UserRepository
	jwtSecret string
}

// NewAuthService creates an AuthService.
func NewAuthService(users *repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: jwtSecret}
}

// Register normalizes the phone, hashes the password, creates the user as
// account_type='private', and returns the created user plus a signed JWT.
func (s *AuthService) Register(ctx context.Context, name, rawPhone, password string) (*models.User, string, error) {
	phone, err := NormalizeKzPhone(rawPhone)
	if err != nil {
		return nil, "", err
	}

	if _, err := s.users.FindByPhone(ctx, phone); err == nil {
		return nil, "", ErrPhoneTaken
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, "", err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", err
	}

	user := &models.User{Name: name, Phone: phone, PasswordHash: string(hash)}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, "", err
	}

	token, err := s.issueToken(user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}

// Login verifies phone + password and returns the user plus a signed JWT.
func (s *AuthService) Login(ctx context.Context, rawPhone, password string) (*models.User, string, error) {
	phone, err := NormalizeKzPhone(rawPhone)
	if err != nil {
		return nil, "", err
	}

	user, err := s.users.FindByPhone(ctx, phone)
	if err != nil {
		return nil, "", ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", ErrInvalidCredentials
	}

	token, err := s.issueToken(user.ID)
	if err != nil {
		return nil, "", err
	}
	return user, token, nil
}

// GetUser loads a user by id, used by the /me endpoint.
func (s *AuthService) GetUser(ctx context.Context, id string) (*models.User, error) {
	return s.users.FindByID(ctx, id)
}

func (s *AuthService) issueToken(userID string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": now.Unix(),
		"exp": now.Add(tokenLifetime).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
