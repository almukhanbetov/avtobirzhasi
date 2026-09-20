import { apiFetch } from "@/lib/api/client";
import type { SellerListing } from "@/types/dashboard";
import type { Car } from "@/types/car";

export function listMyListings(token: string): Promise<SellerListing[]> {
  return apiFetch<SellerListing[]>("/dashboard/listings", { token });
}

export interface CreateListingInput {
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number;
  region: string;
  transmission: string;
  fuelType: string;
  bodyType: string;
  drivetrain: string;
  engineVolume: number;
  enginePower: number;
  color: string;
  steeringWheel: string;
  description?: string;
  images: string[];
  isExchange: boolean;
  // Optional structured location (Stage 5Б) — sent alongside the legacy
  // `region` text above, which stays the Match-compatible field.
  regionId?: string;
  cityId?: string;
  districtId?: string;
}

export function createListing(token: string, input: CreateListingInput): Promise<Car> {
  return apiFetch<Car>("/listings", {
    method: "POST",
    token,
    body: input,
  });
}

// The owner-editable subset of a listing (partial update — every field
// optional). Mirrors the backend's updateListingRequest. System columns
// (status, is_exchange, user_id, …) are intentionally not here.
export interface UpdateListingInput {
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  mileageKm?: number;
  region?: string;
  transmission?: string;
  fuelType?: string;
  bodyType?: string;
  drivetrain?: string;
  engineVolume?: number;
  enginePower?: number;
  color?: string;
  steeringWheel?: string;
  description?: string;
  images?: string[];
  // Stage 5В — same optional structured location as CreateListingInput.
  // Backend derives the authoritative `region` text from these when
  // present; sending regionId with no cityId/districtId clears any
  // previously stored city/district for this listing.
  regionId?: string;
  cityId?: string;
  districtId?: string;
}

export function updateListing(
  token: string,
  id: string,
  input: UpdateListingInput,
): Promise<Car> {
  return apiFetch<Car>(`/listings/${id}`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export function archiveListing(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/listings/${id}`, {
    method: "DELETE",
    token,
  });
}
