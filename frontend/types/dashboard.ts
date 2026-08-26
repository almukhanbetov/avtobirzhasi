import type { Car } from "@/types/car";

export type ListingStatus = "active" | "frozen" | "moderation" | "archived";

export type MatchStatus =
  | "awaiting_deposit"
  | "seller_deposit_paid"
  | "buyer_deposit_paid"
  | "confirmed"
  | "expired"
  | "cancelled";

export type DepositStatus = "pending" | "paid" | "refunded" | "failed";

export type NotificationType =
  | "match_found"
  | "deposit_required"
  | "deposit_received"
  | "contacts_open"
  | "match_expired";

export interface SellerListing {
  id: string;
  car: Car;
  status: ListingStatus;
  updatedAt: string;
}

export interface BuyerRequest {
  id: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  region: string;
  currentOffer: number;
  status: ListingStatus;
  updatedAt: string;
}

export interface MatchDeal {
  id: string;
  car: Car;
  finalPrice: number;
  depositAmount: number;
  sellerDepositPaid: boolean;
  buyerDepositPaid: boolean;
  deadline: string;
  status: MatchStatus;
  role: "seller" | "buyer";
}

export interface Deposit {
  id: string;
  matchId: string;
  car: Car;
  amount: number;
  status: DepositStatus;
  // Always "mock" today — no real payment gateway exists yet. Kept as a
  // plain string (not an enum) since the backend is the source of truth
  // for what providers exist; the frontend just displays whatever it says
  // rather than assuming a closed set.
  provider: string;
  date: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  date: string;
  read: boolean;
}
