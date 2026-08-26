package handlers

import (
	"errors"
	"io"
	"log"
	"net/http"

	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// WebhooksHandler wires the public (unauthenticated — a payment gateway
// cannot present a JWT) payment-result callback routes. This is the ONLY
// path (besides MockPaymentProvider's synchronous resolution) that ever
// marks a deposit paid — see service.DepositService.ConfirmWebhook.
type WebhooksHandler struct {
	provider service.PaymentProvider
	deposits *service.DepositService
}

// NewWebhooksHandler creates a WebhooksHandler.
func NewWebhooksHandler(provider service.PaymentProvider, deposits *service.DepositService) *WebhooksHandler {
	return &WebhooksHandler{provider: provider, deposits: deposits}
}

// RegisterWebhooksRoutes wires the webhook routes. Deliberately outside
// any Auth/AdminOnly/LocalOnly group — these must be reachable from the
// payment provider's own servers on the public internet. Authenticity is
// established entirely by PaymentProvider.VerifyWebhook's signature check,
// not by network position or a bearer token.
func RegisterWebhooksRoutes(router *gin.RouterGroup, h *WebhooksHandler) {
	router.POST("/webhooks/payments/freedompay", h.FreedomPay)
}

// FreedomPay handles FreedomPay's pg_result_url callback. Responds with
// the XML body FreedomPay's protocol expects (pg_status: ok/error) so it
// knows whether to stop retrying delivery.
func (h *WebhooksHandler) FreedomPay(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.XML(http.StatusBadRequest, gin.H{})
		return
	}

	event, err := h.provider.VerifyWebhook(c.Request.Header, body)
	if err != nil {
		if errors.Is(err, service.ErrWebhookInvalid) {
			log.Printf("freedompay webhook: rejected invalid signature")
			c.Data(http.StatusForbidden, "application/xml", []byte(`<response><pg_status>error</pg_status></response>`))
			return
		}
		log.Printf("freedompay webhook: verify failed: %v", err)
		c.Data(http.StatusBadRequest, "application/xml", []byte(`<response><pg_status>error</pg_status></response>`))
		return
	}

	if err := h.deposits.ConfirmWebhook(c.Request.Context(), event); err != nil {
		if errors.Is(err, service.ErrDepositNotFound) {
			log.Printf("freedompay webhook: unknown provider_payment_id %q", event.ProviderPaymentID)
			c.Data(http.StatusOK, "application/xml", []byte(`<response><pg_status>rejected</pg_status></response>`))
			return
		}
		log.Printf("freedompay webhook: confirm failed: %v", err)
		c.Data(http.StatusOK, "application/xml", []byte(`<response><pg_status>error</pg_status></response>`))
		return
	}

	c.Data(http.StatusOK, "application/xml", []byte(`<response><pg_status>ok</pg_status></response>`))
}
