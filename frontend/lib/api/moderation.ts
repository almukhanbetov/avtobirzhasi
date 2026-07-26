import { internalFetch } from "@/lib/api/client";
import type { Car } from "@/types/car";

export interface PendingListing extends Car {
  sellerName: string;
}

export function listPendingListings(): Promise<PendingListing[]> {
  return internalFetch<PendingListing[]>("/internal/listings/pending");
}

export function approveListing(id: string): Promise<void> {
  return internalFetch<void>(`/internal/listings/${id}/approve`, { method: "POST" });
}

export function rejectListing(id: string): Promise<void> {
  return internalFetch<void>(`/internal/listings/${id}/reject`, { method: "POST" });
}
