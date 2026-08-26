package handlers_test

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strings"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/service"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

const testFreedomPaySecret = "webhook-test-secret"

func newWebhookTestServer(pool *pgxpool.Pool, provider service.PaymentProvider) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	deposits := service.NewDepositService(pool, provider)
	api := router.Group("/api")
	handlers.RegisterWebhooksRoutes(api, handlers.NewWebhooksHandler(provider, deposits))
	return httptest.NewServer(router)
}

// seedPendingFreedomPayDeposit seeds a match with a seller deposit already
// moved into the "awaiting a real gateway's webhook" state — as
// DepositService.InitiatePay would leave it for a real (non-mock)
// provider — so the webhook handler test can exercise ConfirmWebhook via
// a real HTTP POST, not a direct service call.
func seedPendingFreedomPayDeposit(t *testing.T, pool *pgxpool.Pool, provider *service.FreedomPayProvider) (depositID, providerPaymentID string) {
	t.Helper()
	sellerID := testutil.InsertUser(t, pool, "+77030000001")
	buyerID := testutil.InsertUser(t, pool, "+77030000002")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Corolla", Region: "Алматы",
		Year: 2021, Price: 9_000_000, IsExchange: true, Status: "frozen",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Toyota", Model: "Corolla", Region: "Алматы",
		YearFrom: 2019, YearTo: 2023, CurrentOffer: 8_950_000, Status: "frozen",
	})
	_, sellerDepositID, _ := testutil.InsertMatch(t, pool, testutil.MatchFixture{
		ListingID: listingID, BuyerRequestID: requestID,
		FinalPrice: 9_000_000, DepositAmount: 90_000,
	})

	providerPaymentID = "pp-" + sellerDepositID
	if _, err := pool.Exec(context.Background(), `
		UPDATE deposits SET status = 'pending', provider = $2, provider_payment_id = $3 WHERE id = $1
	`, sellerDepositID, provider.Name(), providerPaymentID); err != nil {
		t.Fatalf("seed pending provider deposit: %v", err)
	}
	return sellerDepositID, providerPaymentID
}

// signedFreedomPayForm mirrors service.freedomPaySign, but this test lives
// in a different package (handlers_test, no access to that unexported
// helper) — it re-derives the same signature independently, over the
// wire, exactly like a real gateway would when calling our webhook URL.
func signedFreedomPayForm(t *testing.T, resultURL, secretKey string, fields map[string]string) []byte {
	t.Helper()
	scriptName := resultURL
	if idx := strings.LastIndex(resultURL, "/"); idx >= 0 {
		scriptName = resultURL[idx+1:]
	}
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := []string{scriptName}
	for _, k := range keys {
		parts = append(parts, fields[k])
	}
	parts = append(parts, secretKey)
	sum := md5.Sum([]byte(strings.Join(parts, ";")))
	sig := hex.EncodeToString(sum[:])

	values := url.Values{}
	for k, v := range fields {
		values.Set(k, v)
	}
	values.Set("pg_sig", sig)
	return []byte(values.Encode())
}

func TestWebhooksHandler_FreedomPay_ValidSignatureMarksDepositPaid(t *testing.T) {
	pool := testutil.SetupDB(t)
	resultURL := "https://api.avtobirzhasi.test/api/webhooks/payments/freedompay"
	provider := service.NewFreedomPayProvider(service.FreedomPayConfig{
		MerchantID: "merchant-1", SecretKey: testFreedomPaySecret, ResultURL: resultURL,
	})
	server := newWebhookTestServer(pool, provider)
	defer server.Close()

	depositID, providerPaymentID := seedPendingFreedomPayDeposit(t, pool, provider)

	body := signedFreedomPayForm(t, resultURL, testFreedomPaySecret, map[string]string{
		"pg_payment_id": providerPaymentID,
		"pg_result":     "1",
		"pg_amount":     "90000.00",
		"pg_currency":   "KZT",
	})

	resp, err := http.Post(server.URL+"/api/webhooks/payments/freedompay", "application/x-www-form-urlencoded", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("POST webhook: %v", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("webhook status = %d, body = %s", resp.StatusCode, respBody)
	}
	if !strings.Contains(string(respBody), "<pg_status>ok</pg_status>") {
		t.Errorf("webhook response = %s, want pg_status=ok", respBody)
	}

	var status string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM deposits WHERE id = $1`, depositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "paid" {
		t.Errorf("deposit status = %q, want paid", status)
	}
}

func TestWebhooksHandler_FreedomPay_InvalidSignatureRejected(t *testing.T) {
	pool := testutil.SetupDB(t)
	resultURL := "https://api.avtobirzhasi.test/api/webhooks/payments/freedompay"
	provider := service.NewFreedomPayProvider(service.FreedomPayConfig{
		MerchantID: "merchant-1", SecretKey: testFreedomPaySecret, ResultURL: resultURL,
	})
	server := newWebhookTestServer(pool, provider)
	defer server.Close()

	depositID, providerPaymentID := seedPendingFreedomPayDeposit(t, pool, provider)

	// Signed with the wrong secret — simulates a forged/unauthenticated
	// request hitting the public webhook URL.
	body := signedFreedomPayForm(t, resultURL, "wrong-secret", map[string]string{
		"pg_payment_id": providerPaymentID,
		"pg_result":     "1",
		"pg_amount":     "90000.00",
		"pg_currency":   "KZT",
	})

	resp, err := http.Post(server.URL+"/api/webhooks/payments/freedompay", "application/x-www-form-urlencoded", strings.NewReader(string(body)))
	if err != nil {
		t.Fatalf("POST webhook: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		t.Errorf("webhook with an invalid signature returned 200, want it rejected")
	}

	var status string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM deposits WHERE id = $1`, depositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after forged webhook = %q, want still pending (never applied)", status)
	}
}
