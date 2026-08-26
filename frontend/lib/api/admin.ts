import { apiFetch } from "@/lib/api/client";
import type {
  AdminBuyerRequest,
  AdminDeposit,
  AdminListing,
  AdminMatch,
  AdminPage,
  AdminUserRow,
} from "@/types/admin";

export interface AdminStats {
  users: number;
  listings: {
    total: number;
    active: number;
    moderation: number;
    frozen: number;
    archived: number;
    exchange: number;
  };
  buyerRequests: {
    total: number;
    active: number;
    frozen: number;
  };
  matches: {
    total: number;
    awaitingDeposit: number;
    partiallyPaid: number;
    confirmed: number;
    expired: number;
    cancelled: number;
  };
  deposits: {
    total: number;
    pending: number;
    paid: number;
    refunded: number;
  };
}

// Every function here requires an admin-role JWT (middleware.Auth +
// middleware.AdminOnly on the backend). As of Stage 10 these are real
// /api/admin/* routes — reachable from a normal browser session, unlike
// the old /internal/admin/stats path, which LocalOnly made unreachable
// from any real production browser. See
// STAGE10_ADMIN_COMPLETION_REPORT.md.

export function getAdminStats(token: string): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats", { token });
}

export function listAdminListings(
  token: string,
  params: { status?: string; page?: number } = {},
): Promise<AdminPage<AdminListing>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch<AdminPage<AdminListing>>(`/admin/listings${qs ? `?${qs}` : ""}`, { token });
}

export function archiveAdminListing(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/admin/listings/${id}/archive`, { method: "POST", token });
}

export function listAdminRequests(
  token: string,
  params: { status?: string; page?: number } = {},
): Promise<AdminPage<AdminBuyerRequest>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch<AdminPage<AdminBuyerRequest>>(`/admin/requests${qs ? `?${qs}` : ""}`, { token });
}

export function archiveAdminRequest(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/admin/requests/${id}/archive`, { method: "POST", token });
}

export function listAdminMatches(
  token: string,
  params: { status?: string; page?: number } = {},
): Promise<AdminPage<AdminMatch>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch<AdminPage<AdminMatch>>(`/admin/matches${qs ? `?${qs}` : ""}`, { token });
}

export function listAdminDeposits(
  token: string,
  params: { status?: string; page?: number } = {},
): Promise<AdminPage<AdminDeposit>> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch<AdminPage<AdminDeposit>>(`/admin/deposits${qs ? `?${qs}` : ""}`, { token });
}

export function listAdminUsers(
  token: string,
  params: { search?: string; page?: number } = {},
): Promise<AdminPage<AdminUserRow>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiFetch<AdminPage<AdminUserRow>>(`/admin/users${qs ? `?${qs}` : ""}`, { token });
}
