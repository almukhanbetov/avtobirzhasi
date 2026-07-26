import { apiFetch } from "@/lib/api/client";
import type { Car } from "@/types/car";

export function listFavorites(token: string): Promise<Car[]> {
  return apiFetch<Car[]>("/favorites", { token });
}

export function addFavorite(token: string, carId: string): Promise<void> {
  return apiFetch<void>(`/favorites/${carId}`, { method: "POST", token });
}

export function removeFavorite(token: string, carId: string): Promise<void> {
  return apiFetch<void>(`/favorites/${carId}`, { method: "DELETE", token });
}
