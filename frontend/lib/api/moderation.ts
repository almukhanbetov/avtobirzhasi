import { apiFetch } from "@/lib/api/client";
import type { Car } from "@/types/car";

export interface PendingListing extends Car {
  sellerName: string;
}

// These require an admin-role JWT (middleware.Auth + middleware.AdminOnly
// on the backend) — see STAGE1_ADMIN_AUTHORIZATION_REPORT.md. The token
// must belong to a users.role='admin' account or the backend returns
// 401/403. As of Stage 10 these are real /api/admin/* routes, not
// /internal/* — LocalOnly made the old path unreachable from any actual
// production browser session; see STAGE10_ADMIN_COMPLETION_REPORT.md.
export function listPendingListings(token: string): Promise<PendingListing[]> {
  return apiFetch<PendingListing[]>("/admin/listings/pending", { token });
}

export function approveListing(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/admin/listings/${id}/approve`, { method: "POST", token });
}

export function rejectListing(id: string, token: string): Promise<void> {
  return apiFetch<void>(`/admin/listings/${id}/reject`, { method: "POST", token });
}
