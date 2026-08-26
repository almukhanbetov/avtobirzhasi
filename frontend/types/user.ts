export type AccountType = "private" | "dealer";
export type UserRole = "user" | "admin";

// Mirrors the backend's userResponse (internal/handlers/response.go).
export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  region?: string;
  accountType: AccountType;
  role: UserRole;
  rating: number;
  reviewsCount: number;
  since: string;
}
