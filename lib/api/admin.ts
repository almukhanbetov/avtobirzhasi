import { internalFetch } from "@/lib/api/client";

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

export function getAdminStats(): Promise<AdminStats> {
  return internalFetch<AdminStats>("/internal/admin/stats");
}
