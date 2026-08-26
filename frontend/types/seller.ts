export type SellerType = "private" | "dealer";

export interface Seller {
  id: string;
  name: string;
  type: SellerType;
  since: string;
  rating: number;
  reviewsCount: number;
  activeListings: number;
  phone: string;
}
