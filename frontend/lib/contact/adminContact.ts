// The single phone number shown anywhere the site used to (or would)
// reveal a seller's own number directly to a buyer — the catalog, a
// listing's detail page, a confirmed Match, the manual "buy now" deposit
// flow. Sellers' real numbers stay in PostgreSQL for internal business
// use (see backend/internal/handlers/seller_response.go and
// match_response.go's doc comments) and are never sent to this frontend
// in any of those contexts — there is nothing here to keep in sync with
// a backend value, this constant is the only source of truth.
//
// Import this everywhere a phone number needs to be shown or dialed
// instead of hardcoding the digits again — see AdminContactLink.tsx for
// the shared "Показать номер"-style UI built on top of it.
export const ADMIN_CONTACT = {
  displayPhone: "+7 702 789 7120",
  telPhone: "+77027897120",
} as const;
