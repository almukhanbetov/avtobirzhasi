import { apiFetch } from "@/lib/api/client";
import type { Car } from "@/types/car";
import type { CarFilters } from "@/features/listings/filterCars";

export interface CarsListResponse {
  items: Car[];
  total: number;
  totalPages: number;
  page: number;
}

function buildCarsQuery(filters: CarFilters): string {
  const params = new URLSearchParams();
  if (filters.region) params.set("region", filters.region);
  if (filters.make) params.set("make", filters.make);
  if (filters.model) params.set("model", filters.model);
  if (filters.yearFrom) params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo) params.set("yearTo", String(filters.yearTo));
  if (filters.priceFrom) params.set("priceFrom", String(filters.priceFrom));
  if (filters.priceTo) params.set("priceTo", String(filters.priceTo));
  if (filters.bodyType) params.set("bodyType", filters.bodyType);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.drivetrain) params.set("drivetrain", filters.drivetrain);
  if (filters.fuelType) params.set("fuelType", filters.fuelType);
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  return params.toString();
}

// listCars matches GET /api/cars — the backend does the filtering,
// sorting and pagination now (see features/listings/filterCars.ts's
// CarFilters, which this reuses field-for-field).
export function listCars(filters: CarFilters): Promise<CarsListResponse> {
  return apiFetch<CarsListResponse>(`/cars?${buildCarsQuery(filters)}`);
}

export function getCar(id: string): Promise<Car> {
  return apiFetch<Car>(`/cars/${id}`);
}

export function getSimilarCars(id: string): Promise<Car[]> {
  return apiFetch<Car[]>(`/cars/${id}/similar`);
}
