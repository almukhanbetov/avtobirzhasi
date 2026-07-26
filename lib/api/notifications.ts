import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/types/dashboard";

export function listMyNotifications(token: string): Promise<Notification[]> {
  return apiFetch<Notification[]>("/notifications", { token });
}

export function markNotificationRead(token: string, id: string): Promise<void> {
  return apiFetch<void>(`/notifications/${id}/read`, { method: "PATCH", token });
}
