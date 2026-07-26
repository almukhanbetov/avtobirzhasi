import { apiFetch } from "@/lib/api/client";

// DashboardTask mirrors the backend's dashboardTask (see SKILL.md's
// Dashboard overview section) — only the fields relevant to `type` are
// set: deposit_required carries matchId+deadline, moderation carries
// listingId, notification carries notificationId.
export interface DashboardTask {
  type: "deposit_required" | "moderation" | "notification";
  message: string;
  matchId?: string;
  deadline?: string;
  listingId?: string;
  notificationId?: string;
}

export interface DashboardOverview {
  activeListings: number;
  buyerRequests: number;
  activeMatches: number;
  favorites: number;
  tasks: DashboardTask[];
}

export function getDashboardOverview(token: string): Promise<DashboardOverview> {
  return apiFetch<DashboardOverview>("/dashboard/overview", { token });
}
