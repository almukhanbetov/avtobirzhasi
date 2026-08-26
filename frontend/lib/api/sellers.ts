import { apiFetch } from "@/lib/api/client";
import type { Seller } from "@/types/seller";

export function getSeller(id: string): Promise<Seller> {
  return apiFetch<Seller>(`/sellers/${id}`);
}
