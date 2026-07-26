export type AccountType = "private" | "dealer";

// Mirrors the backend's userResponse (internal/handlers/response.go).
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  region?: string;
  accountType: AccountType;
  rating: number;
  reviewsCount: number;
  since: string;
}
