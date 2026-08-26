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
}

export function createListing(token: string, input: CreateListingInput): Promise<Car> {
  return apiFetch<Car>("/listings", {
    method: "POST",
    token,
    body: input,
  });
}

export interface UpdateListingInput {
  price?: number;
  mileageKm?: number;
  description?: string;
  region?: string;
  color?: string;
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
