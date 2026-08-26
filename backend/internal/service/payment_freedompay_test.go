package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// TestFreedomPaySign_KnownVector pins the signature algorithm against a
// hand-computed value (md5sum of the exact expected concatenation),
// independent of this package's own implementation — a regression here
// would mean every request/webhook silently starts failing signature
// checks against the real gateway.
func TestFreedomPaySign_KnownVector(t *testing.T) {
	// Expected string: "init_payment.php;10000.00;test-merchant;order-1;abc123;s3cr3t"
	// (script name, then pg_amount/pg_merchant_id/pg_order_id/pg_salt in
	// alphabetical key order, then the secret key), joined with ";".
	// md5("init_payment.php;10000.00;test-merchant;order-1;abc123;s3cr3t")
	// computed independently via `printf '%s' "$STRING" | md5sum`.
	const want = "63c3106658e57e192893889e99f5146b"

	params := map[string]string{
		"pg_amount":      "10000.00",
		"pg_merchant_id": "test-merchant",
		"pg_order_id":    "order-1",
		"pg_salt":        "abc123",
	}
	got := freedomPaySign("init_payment.php", params, "s3cr3t")
	if got != want {
		t.Errorf("freedomPaySign = %q, want %q", got, want)
	}
}

func TestFreedomPaySign_OrderIndependent(t *testing.T) {
	params := map[string]string{"pg_b": "2", "pg_a": "1", "pg_c": "3"}
	a := freedomPaySign("script.php", params, "secret")
	params2 := map[string]string{"pg_c": "3", "pg_a": "1", "pg_b": "2"}
	b := freedomPaySign("script.php", params2, "secret")
	if a != b {
		t.Errorf("signature depends on map insertion order — must sort keys alphabetically first")
	}
}

func TestScriptNameFromURL(t *testing.T) {
	cases := map[string]string{
		"https://api.avtobirzhasi.kz/api/webhooks/payments/freedompay": "freedompay",
		"https://api.avtobirzhasi.kz/init_payment.php":                 "init_payment.php",
		"https://api.avtobirzhasi.kz/webhook/":                         "webhook",
	}
	for input, want := range cases {
		if got := scriptNameFromURL(input); got != want {
			t.Errorf("scriptNameFromURL(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseTengeAmount(t *testing.T) {
	cases := []struct {
		in      string
		want    int64
		wantErr bool
	}{
		{"150000.00", 150000, false},
		{"150000", 150000, false},
		{"150000.50", 0, true},
		{"not-a-number", 0, true},
	}
	for _, tc := range cases {
		got, err := parseTengeAmount(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Errorf("parseTengeAmount(%q) error = nil, want an error", tc.in)
			}
			continue
		}
		if err != nil {
			t.Errorf("parseTengeAmount(%q) unexpected error: %v", tc.in, err)
		}
		if got != tc.want {
			t.Errorf("parseTengeAmount(%q) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func testFreedomPayProvider(t *testing.T, baseURL string) *FreedomPayProvider {
	t.Helper()
	return NewFreedomPayProvider(FreedomPayConfig{
		MerchantID: "test-merchant",
		SecretKey:  "s3cr3t",
		ResultURL:  "https://api.avtobirzhasi.kz/api/webhooks/payments/freedompay",
		BaseURL:    baseURL,
	})
}

func TestFreedomPayProvider_CreatePayment_ParsesRedirect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/init_payment.php" {
			t.Errorf("called path %q, want /init_payment.php", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/xml")
		fmt.Fprint(w, `<response><pg_status>ok</pg_status><pg_payment_id>555</pg_payment_id><pg_redirect_url>https://pay.freedompay.kz/555</pg_redirect_url></response>`)
	}))
	defer server.Close()

	provider := testFreedomPayProvider(t, server.URL)
	result, err := provider.CreatePayment(context.Background(), "deposit-1", 100_000, "")
	if err != nil {
		t.Fatalf("CreatePayment: %v", err)
	}
	if result.ProviderPaymentID != "555" {
		t.Errorf("ProviderPaymentID = %q, want 555", result.ProviderPaymentID)
	}
	if result.RedirectURL != "https://pay.freedompay.kz/555" {
		t.Errorf("RedirectURL = %q, want the hosted page URL", result.RedirectURL)
	}
	if result.Status != PaymentStatusPending {
		t.Errorf("Status = %q, want pending (a real gateway never resolves synchronously)", result.Status)
	}
}

func TestFreedomPayProvider_CreatePayment_ErrorResponseRejected(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `<response><pg_status>error</pg_status><pg_error_code>101</pg_error_code><pg_error_description>merchant not found</pg_error_description></response>`)
	}))
	defer server.Close()

	provider := testFreedomPayProvider(t, server.URL)
	_, err := provider.CreatePayment(context.Background(), "deposit-1", 100_000, "")
	if err == nil {
		t.Fatalf("CreatePayment succeeded, want an error for pg_status=error")
	}
}

func TestFreedomPayProvider_GetPaymentStatus_MapsTransactionStatus(t *testing.T) {
	cases := map[string]PaymentStatus{
		"captured":  PaymentStatusSucceeded,
		"cancelled": PaymentStatusFailed,
		"pending":   PaymentStatusPending,
	}
	for txStatus, want := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, `<response><pg_status>ok</pg_status><pg_transaction_status>%s</pg_transaction_status></response>`, txStatus)
		}))
		provider := testFreedomPayProvider(t, server.URL)
		got, err := provider.GetPaymentStatus(context.Background(), "555")
		server.Close()
		if err != nil {
			t.Fatalf("GetPaymentStatus (%s): %v", txStatus, err)
		}
		if got != want {
			t.Errorf("GetPaymentStatus mapped pg_transaction_status=%q to %q, want %q", txStatus, got, want)
		}
	}
}

// buildSignedWebhookBody constructs a form-encoded webhook body signed
// exactly as FreedomPay would sign a callback to our result URL.
func buildSignedWebhookBody(t *testing.T, provider *FreedomPayProvider, fields map[string]string) []byte {
	t.Helper()
	scriptName := scriptNameFromURL(provider.cfg.ResultURL)
	sig := freedomPaySign(scriptName, fields, provider.cfg.SecretKey)

	values := url.Values{}
	for k, v := range fields {
		values.Set(k, v)
	}
	values.Set("pg_sig", sig)
	return []byte(values.Encode())
}

func TestFreedomPayProvider_VerifyWebhook_ValidSignatureAccepted(t *testing.T) {
	provider := testFreedomPayProvider(t, "https://unused.example")
	body := buildSignedWebhookBody(t, provider, map[string]string{
		"pg_payment_id": "555",
		"pg_order_id":   "deposit-1",
		"pg_result":     "1",
		"pg_amount":     "100000.00",
		"pg_currency":   "KZT",
	})

	event, err := provider.VerifyWebhook(http.Header{}, body)
	if err != nil {
		t.Fatalf("VerifyWebhook: %v", err)
	}
	if event.ProviderPaymentID != "555" || event.Status != PaymentStatusSucceeded || event.AmountTenge != 100_000 || event.Currency != "KZT" {
		t.Errorf("VerifyWebhook parsed event = %+v, unexpected", event)
	}
}

func TestFreedomPayProvider_VerifyWebhook_TamperedAmountRejected(t *testing.T) {
	provider := testFreedomPayProvider(t, "https://unused.example")
	body := buildSignedWebhookBody(t, provider, map[string]string{
		"pg_payment_id": "555",
		"pg_result":     "1",
		"pg_amount":     "100000.00",
		"pg_currency":   "KZT",
	})

	// Tamper with pg_amount after signing — simulates an attacker
	// modifying the request without knowing the secret key.
	tampered := strings.Replace(string(body), "100000.00", "1.00", 1)

	_, err := provider.VerifyWebhook(http.Header{}, []byte(tampered))
	if err == nil {
		t.Fatalf("VerifyWebhook accepted a tampered payload")
	}
}

func TestFreedomPayProvider_VerifyWebhook_MissingSignatureRejected(t *testing.T) {
	provider := testFreedomPayProvider(t, "https://unused.example")
	body := []byte("pg_payment_id=555&pg_result=1&pg_amount=100000.00&pg_currency=KZT")

	_, err := provider.VerifyWebhook(http.Header{}, body)
	if err == nil {
		t.Fatalf("VerifyWebhook accepted a payload with no pg_sig at all")
	}
}

func TestFreedomPayProvider_Refund_ParsesRefundID(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `<response><pg_status>ok</pg_status><pg_payment_refund_id>r-1</pg_payment_refund_id></response>`)
	}))
	defer server.Close()

	provider := testFreedomPayProvider(t, server.URL)
	refundID, err := provider.Refund(context.Background(), "555", 100_000)
	if err != nil {
		t.Fatalf("Refund: %v", err)
	}
	if refundID != "r-1" {
		t.Errorf("refundID = %q, want r-1", refundID)
	}
}

func TestNewFreedomPayProvider_PanicsWithoutCredentials(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Errorf("NewFreedomPayProvider did not panic with empty credentials")
		}
	}()
	NewFreedomPayProvider(FreedomPayConfig{})
}
