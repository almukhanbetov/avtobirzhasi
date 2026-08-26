package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// requireUUIDParam is the fix for the malformed-UUID-500 gap the
// completion audit flagged (Stage 3) — a bad id must never reach a
// repository/SQL call at all.
func TestRequireUUIDParam(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name  string
		param string
		ok    bool
	}{
		{"valid uuid", "931516f6-cb60-44be-9c65-2f7d9620fa47", true},
		{"valid nil uuid", "00000000-0000-0000-0000-000000000000", true},
		{"valid uppercase", "931516F6-CB60-44BE-9C65-2F7D9620FA47", true},
		{"slug-shaped id", "car-3", false},
		{"empty", "", false},
		{"one char short", "931516f6-cb60-44be-9c65-2f7d9620fa4", false},
		{"one char long", "931516f6-cb60-44be-9c65-2f7d9620fa477", false},
		{"missing dashes", "931516f6cb6044be9c652f7d9620fa47", false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "id", Value: tc.param}}

			id, ok := requireUUIDParam(c, "id")

			if ok != tc.ok {
				t.Fatalf("requireUUIDParam(%q) ok = %v, want %v", tc.param, ok, tc.ok)
			}
			if tc.ok && id != tc.param {
				t.Errorf("requireUUIDParam(%q) id = %q, want unchanged", tc.param, id)
			}
			if !tc.ok && w.Code != 400 {
				t.Errorf("requireUUIDParam(%q) wrote status %d, want 400", tc.param, w.Code)
			}
		})
	}
}
