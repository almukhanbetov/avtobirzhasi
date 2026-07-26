package service

import (
	"errors"
	"regexp"
	"strings"
)

// ErrInvalidPhone is returned when a phone number cannot be normalized into
// a valid +7XXXXXXXXXX Kazakhstan number.
var ErrInvalidPhone = errors.New("invalid phone")

var (
	eightPrefixPhone = regexp.MustCompile(`^8\d{10}$`)
	sevenPrefixPhone = regexp.MustCompile(`^7\d{10}$`)
	bareTenDigits    = regexp.MustCompile(`^\d{10}$`)
	validKzPhone     = regexp.MustCompile(`^\+7\d{10}$`)
	phoneFormatting  = strings.NewReplacer(" ", "", "(", "", ")", "", "-", "")
)

// NormalizeKzPhone mirrors frontend/lib/validation/auth.ts exactly: it
// accepts a number typed as 8XXXXXXXXXX, 7XXXXXXXXXX, or a bare 10-digit
// local number (in addition to an already-correct +7XXXXXXXXXX), and
// normalizes all of them to +7XXXXXXXXXX. The backend re-validates
// defensively rather than trusting that the frontend already normalized —
// see SKILL.md's Auth section.
func NormalizeKzPhone(raw string) (string, error) {
	cleaned := phoneFormatting.Replace(raw)

	switch {
	case eightPrefixPhone.MatchString(cleaned):
		cleaned = "+7" + cleaned[1:]
	case sevenPrefixPhone.MatchString(cleaned):
		cleaned = "+" + cleaned
	case bareTenDigits.MatchString(cleaned):
		cleaned = "+7" + cleaned
	}

	if !validKzPhone.MatchString(cleaned) {
		return "", ErrInvalidPhone
	}
	return cleaned, nil
}
