import { apiFetch } from "@/lib/api/client";
import type { AuthUser } from "@/types/user";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function register(input: {
  name: string;
  phone: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function login(input: {
  phone: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function me(token: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me", { token });
}
