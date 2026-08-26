import type { Car } from "@/types/car";
import type { ListingStatus, MatchStatus, DepositStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/user";

// Shared envelope every /api/admin/* list endpoint returns — mirrors the
// public catalog's own {items, total, totalPages, page} shape
// (backend/internal/handlers/cars.go's List), just reused for admin
// monitoring views instead of the public catalog.
export interface AdminPage<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

export interface AdminListing {
  id: string;
  car: Car;
  status: ListingStatus;
  updatedAt: string;
  sellerName: string;
}

export interface AdminBuyerRequest {
  id: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  region: string;
  currentOffer: number;
  status: ListingStatus;
  updatedAt: string;
  buyerName: string;
}

export interface AdminMatch {
  id: string;
  listingId: string;
  buyerRequestId: string;
  sellerUserId: string;
  buyerUserId: string;
  finalPrice: number;
  depositAmount: number;
  sellerDepositPaid: boolean;
  buyerDepositPaid: boolean;
  status: MatchStatus;
  deadline: string;
  createdAt: string;
}

export interface AdminDeposit {
  id: string;
  matchId: string;
  userId: string;
  role: "seller" | "buyer";
  amount: number;
  status: DepositStatus;
  provider: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

export type AdminUserRow = AuthUser;
