import { apiFetch } from "@/lib/api/client";
import type { MatchDeal } from "@/types/dashboard";

export function listMyMatches(token: string): Promise<MatchDeal[]> {
  return apiFetch<MatchDeal[]>("/dashboard/matches", { token });
}
