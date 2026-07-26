import { apiFetch } from "@/lib/api/client";
import type { Seller } from "@/lib/mock/sellers";

export function getSeller(id: string): Promise<Seller> {
  return apiFetch<Seller>(`/sellers/${id}`);
}
