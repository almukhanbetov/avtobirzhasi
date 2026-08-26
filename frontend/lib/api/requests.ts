import { apiFetch } from "@/lib/api/client";
import type { BuyerRequest } from "@/types/dashboard";

export function listMyRequests(token: string): Promise<BuyerRequest[]> {
  return apiFetch<BuyerRequest[]>("/dashboard/requests", { token });
}

export interface CreateRequestInput {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  region: string;
  initialOffer: number;
}

export function createRequest(
  token: string,
  input: CreateRequestInput,
): Promise<BuyerRequest> {
  return apiFetch<BuyerRequest>("/requests", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateRequest(
  token: string,
  id: string,
  input: { region: string },
): Promise<BuyerRequest> {
  return apiFetch<BuyerRequest>(`/requests/${id}`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export function cancelRequest(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/requests/${id}`, {
    method: "DELETE",
    token,
  });
}
