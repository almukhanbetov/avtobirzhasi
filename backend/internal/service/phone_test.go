package service

import "testing"

// The four accepted input shapes come straight from
// frontend/lib/validation/auth.ts — see SKILL.md's Auth section and
// phone.go's doc comment. All four must normalize identically.
func TestNormalizeKzPhone_AcceptsAllFourFormats(t *testing.T) {
	cases := []struct {
		name string
		in   string
	}{
		{"8-prefixed", "87071234567"},
		{"7-prefixed", "77071234567"},
		{"bare 10 digits", "7071234567"},
		{"already normalized", "+77071234567"},
		{"formatted with spaces and parens", "8 (707) 123-45-67"},
	}
	const want = "+77071234567"

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := NormalizeKzPhone(tc.in)
			if err != nil {
				t.Fatalf("NormalizeKzPhone(%q) returned error: %v", tc.in, err)
			}
			if got != want {
				t.Errorf("NormalizeKzPhone(%q) = %q, want %q", tc.in, got, want)
			}
		})
	}
}

func TestNormalizeKzPhone_RejectsInvalid(t *testing.T) {
	cases := []string{
		"",
		"123",
		"770712345",    // 9 digits, too short
		"770712345678", // 12 digits, too long
		"+1234567890",  // wrong country code
		"abcdefghij",
	}

	for _, in := range cases {
		t.Run(in, func(t *testing.T) {
			if _, err := NormalizeKzPhone(in); err != ErrInvalidPhone {
				t.Errorf("NormalizeKzPhone(%q) error = %v, want ErrInvalidPhone", in, err)
			}
		})
	}
}
