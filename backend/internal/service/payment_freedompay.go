package service

import (
	"bytes"
	"context"
	"crypto/md5"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// FreedomPayConfig holds the merchant credentials and callback URLs
// FreedomPayProvider needs. Loaded from env in cmd/api/main.go — never
// hardcode a merchant_id/secret_key.
type FreedomPayConfig struct {
	MerchantID  string
	SecretKey   string
	TestingMode bool
	ResultURL   string // FreedomPay POSTs the final payment result here (server-to-server)
	SuccessURL  string // browser is redirected here after a successful hosted-page payment
	FailureURL  string // browser is redirected here after a failed/cancelled one
	BaseURL     string // defaults to https://api.freedompay.kz if empty
}

const freedomPayDefaultBaseURL = "https://api.freedompay.kz"

// FreedomPayProvider implements PaymentProvider against FreedomPay's
// Merchant API (https://freedompay.kz/docs-en/merchant-api/) — the gateway
// uibirzhasi.kz's own payment-instructions page names explicitly as who
// processes their card payments. This is the classic "pg_"-parameter
// protocol shared by several CIS payment gateways: every request and
// response is signed with an MD5 hash of script-name + alphabetically
// sorted fields (plus a random pg_salt) + the merchant's secret_key.
//
// IMPORTANT: the exact response field names for GetPaymentStatus and the
// exact refund endpoint path were reconstructed from FreedomPay's public
// documentation pages, not verified against a live sandbox call (no
// sandbox credentials were available while writing this) — see
// STAGE11_REAL_PAYMENT_REPORT.md's "Verified vs. Assumed" section before
// enabling this in production.
type FreedomPayProvider struct {
	cfg    FreedomPayConfig
	client *http.Client
}

// NewFreedomPayProvider creates a FreedomPayProvider. Panics if merchantID
// or secretKey is empty — callers (main.go) must only construct this once
// both are confirmed present, exactly like any other required credential.
func NewFreedomPayProvider(cfg FreedomPayConfig) *FreedomPayProvider {
	if cfg.MerchantID == "" || cfg.SecretKey == "" {
		panic("service: FreedomPayProvider requires a non-empty MerchantID and SecretKey")
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = freedomPayDefaultBaseURL
	}
	return &FreedomPayProvider{
		cfg:    cfg,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *FreedomPayProvider) Name() string { return "freedompay" }

// freedomPaySign implements the documented signature algorithm: concatenate
// the script name, then every field's value in alphabetical order of its
// key (params must NOT include pg_sig itself), then the secret key —
// joined with ";" — and take the hex MD5 of that string.
func freedomPaySign(scriptName string, params map[string]string, secretKey string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys)+2)
	parts = append(parts, scriptName)
	for _, k := range keys {
		parts = append(parts, params[k])
	}
	parts = append(parts, secretKey)

	sum := md5.Sum([]byte(strings.Join(parts, ";")))
	return hex.EncodeToString(sum[:])
}

// scriptNameFromURL returns the last path segment of a URL — the "script
// name" the signature algorithm expects, whether it's an endpoint we call
// on FreedomPay (e.g. "init_payment.php") or our own webhook URL that
// FreedomPay calls back.
func scriptNameFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	path := strings.TrimRight(u.Path, "/")
	if idx := strings.LastIndex(path, "/"); idx >= 0 {
		return path[idx+1:]
	}
	return path
}

// appendQueryParam adds a query parameter to a URL, preserving any that
// are already there.
func appendQueryParam(rawURL, key, value string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	q.Set(key, value)
	u.RawQuery = q.Encode()
	return u.String()
}

func randomSalt() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// tengeToAmount formats a whole-tenge integer as the decimal string
// FreedomPay's pg_amount expects (minimum 0.01, two decimal places).
func tengeToAmount(amountTenge int64) string {
	return fmt.Sprintf("%d.00", amountTenge)
}

type freedomPayInitResponse struct {
	XMLName          xml.Name `xml:"response"`
	Status           string   `xml:"pg_status"`
	PaymentID        string   `xml:"pg_payment_id"`
	RedirectURL      string   `xml:"pg_redirect_url"`
	ErrorCode        string   `xml:"pg_error_code"`
	ErrorDescription string   `xml:"pg_error_description"`
}

func (p *FreedomPayProvider) CreatePayment(ctx context.Context, depositID string, amountTenge int64, idempotencyKey string) (CreatePaymentResult, error) {
	salt, err := randomSalt()
	if err != nil {
		return CreatePaymentResult{}, fmt.Errorf("freedompay: generate salt: %w", err)
	}

	// pg_order_id is the deposit's own id — stable and unique per deposit,
	// so a frontend retry that calls this again naturally reuses the same
	// order id instead of creating a second chargeable session.
	params := map[string]string{
		"pg_order_id":    depositID,
		"pg_merchant_id": p.cfg.MerchantID,
		"pg_amount":      tengeToAmount(amountTenge),
		"pg_description": "Депозит avtobirzhasi.kz",
		"pg_currency":    "KZT",
		"pg_salt":        salt,
	}
	if p.cfg.ResultURL != "" {
		params["pg_result_url"] = p.cfg.ResultURL
	}
	// depositId is embedded in the return URLs (not left to the gateway to
	// echo back a param of its own) so the frontend's return page always
	// knows which deposit to poll — this is only ever used to pick which
	// status to display, never to decide payment success itself; only
	// ConfirmWebhook/CheckStatus can do that.
	if p.cfg.SuccessURL != "" {
		params["pg_success_url"] = appendQueryParam(p.cfg.SuccessURL, "depositId", depositID)
	}
	if p.cfg.FailureURL != "" {
		params["pg_failure_url"] = appendQueryParam(p.cfg.FailureURL, "depositId", depositID)
	}
	if p.cfg.TestingMode {
		params["pg_testing_mode"] = "1"
	}
	params["pg_sig"] = freedomPaySign("init_payment.php", params, p.cfg.SecretKey)

	var parsed freedomPayInitResponse
	if err := p.post(ctx, "/init_payment.php", params, &parsed); err != nil {
		return CreatePaymentResult{}, err
	}
	if parsed.Status != "ok" {
		return CreatePaymentResult{}, fmt.Errorf("freedompay: init_payment.php rejected (%s): %s", parsed.ErrorCode, parsed.ErrorDescription)
	}
	if parsed.PaymentID == "" || parsed.RedirectURL == "" {
		return CreatePaymentResult{}, fmt.Errorf("freedompay: init_payment.php returned pg_status=ok without a payment id/redirect url")
	}

	return CreatePaymentResult{
		ProviderPaymentID: parsed.PaymentID,
		RedirectURL:       parsed.RedirectURL,
		Status:            PaymentStatusPending,
	}, nil
}

type freedomPayStatusResponse struct {
	XMLName           xml.Name `xml:"response"`
	Status            string   `xml:"pg_status"`
	TransactionStatus string   `xml:"pg_transaction_status"`
	ErrorCode         string   `xml:"pg_error_code"`
	ErrorDescription  string   `xml:"pg_error_description"`
}

func (p *FreedomPayProvider) GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error) {
	salt, err := randomSalt()
	if err != nil {
		return "", fmt.Errorf("freedompay: generate salt: %w", err)
	}
	params := map[string]string{
		"pg_merchant_id": p.cfg.MerchantID,
		"pg_payment_id":  providerPaymentID,
		"pg_salt":        salt,
	}
	params["pg_sig"] = freedomPaySign("get_status3.php", params, p.cfg.SecretKey)

	var parsed freedomPayStatusResponse
	if err := p.post(ctx, "/get_status3.php", params, &parsed); err != nil {
		return "", err
	}
	if parsed.Status != "ok" {
		return "", fmt.Errorf("freedompay: get_status3.php rejected (%s): %s", parsed.ErrorCode, parsed.ErrorDescription)
	}

	switch parsed.TransactionStatus {
	case "captured":
		return PaymentStatusSucceeded, nil
	case "cancelled", "chargeback", "revoked":
		return PaymentStatusFailed, nil
	default:
		return PaymentStatusPending, nil
	}
}

func (p *FreedomPayProvider) VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error) {
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return WebhookEvent{}, fmt.Errorf("%w: malformed body: %v", ErrWebhookInvalid, err)
	}

	params := make(map[string]string, len(values))
	for k := range values {
		params[k] = values.Get(k)
	}
	receivedSig := params["pg_sig"]
	if receivedSig == "" {
		return WebhookEvent{}, fmt.Errorf("%w: missing pg_sig", ErrWebhookInvalid)
	}
	delete(params, "pg_sig")

	scriptName := scriptNameFromURL(p.cfg.ResultURL)
	expectedSig := freedomPaySign(scriptName, params, p.cfg.SecretKey)
	if subtle.ConstantTimeCompare([]byte(receivedSig), []byte(expectedSig)) != 1 {
		return WebhookEvent{}, ErrWebhookInvalid
	}

	var status PaymentStatus
	switch params["pg_result"] {
	case "1":
		status = PaymentStatusSucceeded
	case "0":
		status = PaymentStatusFailed
	default:
		status = PaymentStatusPending
	}

	amountTenge, err := parseTengeAmount(params["pg_amount"])
	if err != nil {
		return WebhookEvent{}, fmt.Errorf("%w: unparseable pg_amount %q: %v", ErrWebhookInvalid, params["pg_amount"], err)
	}

	return WebhookEvent{
		ProviderPaymentID: params["pg_payment_id"],
		Status:            status,
		AmountTenge:       amountTenge,
		Currency:          params["pg_currency"],
	}, nil
}

// parseTengeAmount parses FreedomPay's decimal amount string (e.g.
// "150000.00") back into whole tenge, rejecting anything with a non-zero
// fractional part — this codebase never stores fractional tenge.
func parseTengeAmount(s string) (int64, error) {
	whole, frac, hasFrac := strings.Cut(s, ".")
	n, err := strconv.ParseInt(whole, 10, 64)
	if err != nil {
		return 0, err
	}
	if hasFrac {
		for _, c := range frac {
			if c != '0' {
				return 0, fmt.Errorf("non-zero fractional tenge in amount %q", s)
			}
		}
	}
	return n, nil
}

type freedomPayRefundResponse struct {
	XMLName          xml.Name `xml:"response"`
	Status           string   `xml:"pg_status"`
	RefundID         string   `xml:"pg_payment_refund_id"`
	RefundStatus     string   `xml:"pg_refund_status"`
	ErrorCode        string   `xml:"pg_error_code"`
	ErrorDescription string   `xml:"pg_error_description"`
}

func (p *FreedomPayProvider) Refund(ctx context.Context, providerPaymentID string, amountTenge int64) (string, error) {
	salt, err := randomSalt()
	if err != nil {
		return "", fmt.Errorf("freedompay: generate salt: %w", err)
	}
	params := map[string]string{
		"pg_merchant_id": p.cfg.MerchantID,
		"pg_payment_id":  providerPaymentID,
		"pg_amount":      tengeToAmount(amountTenge),
		"pg_currency":    "KZT",
		"pg_salt":        salt,
	}
	params["pg_sig"] = freedomPaySign("refund", params, p.cfg.SecretKey)

	var parsed freedomPayRefundResponse
	if err := p.post(ctx, "/g2g/refund", params, &parsed); err != nil {
		return "", err
	}
	if parsed.Status != "ok" {
		return "", fmt.Errorf("freedompay: refund rejected (%s): %s", parsed.ErrorCode, parsed.ErrorDescription)
	}
	return parsed.RefundID, nil
}

// post sends params as a form-encoded POST to path on FreedomPay's API and
// unmarshals the XML response into out.
func (p *FreedomPayProvider) post(ctx context.Context, path string, params map[string]string, out any) error {
	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.cfg.BaseURL+path, bytes.NewBufferString(form.Encode()))
	if err != nil {
		return fmt.Errorf("freedompay: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("freedompay: request to %s failed: %w", path, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("freedompay: read response from %s: %w", path, err)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("freedompay: %s returned HTTP %d: %s", path, resp.StatusCode, string(body))
	}
	if err := xml.Unmarshal(body, out); err != nil {
		return fmt.Errorf("freedompay: unmarshal response from %s: %w (body: %s)", path, err, string(body))
	}
	return nil
}
