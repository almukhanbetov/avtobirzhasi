export type SellerType = "private" | "dealer";

// Stage 9Б-17: mirrors backend/internal/handlers/seller_response.go's
// sellerResponse exactly — GET /api/sellers/:id is public/unauthenticated
// and never returns phone (see that file's doc comment for why). A
// counterparty's phone only ever comes from GET /api/matches/:id, once
// that match is confirmed — a separate, unrelated type
// (matchDetailResponse's counterpart), not this one.
export interface Seller {
  id: string;
  name: string;
  type: SellerType;
  since: string;
  rating: number;
  reviewsCount: number;
  activeListings: number;
}
