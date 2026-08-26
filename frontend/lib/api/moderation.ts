import { internalFetch } from "@/lib/api/client";
import type { Car } from "@/types/car";

export interface PendingListing extends Car {
  sellerName: string;
}

// These now require an admin-role JWT (middleware.Auth + middleware.AdminOnly
// on the backend, on top of the existing LocalOnly network check) — see
// STAGE1_ADMIN_AUTHORIZATION_REPORT.md. The token must belong to a
// users.role='admin' account or the backend returns 401/403.
export function listPendingListings(token: string): Promise<PendingListing[]> {
  return internalFetch<PendingListing[]>("/internal/listings/pending", { token });
}

export function approveListing(id: string, token: string): Promise<void> {
  return internalFetch<void>(`/internal/listings/${id}/approve`, { method: "POST", token });
}

export function rejectListing(id: string, token: string): Promise<void> {
  return internalFetch<void>(`/internal/listings/${id}/reject`, { method: "POST", token });
}
