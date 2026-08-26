import { apiFetch } from "@/lib/api/client";
import type { Deposit, DepositStatus } from "@/types/dashboard";

export function listMyDeposits(token: string): Promise<Deposit[]> {
  return apiFetch<Deposit[]>("/dashboard/deposits", { token });
}

// PayDepositResponse is a union: MockPaymentProvider (or any provider that
// resolves synchronously) returns the final id/status/matchStatus exactly
// like before Stage 11's real-payment architecture existed. A real
// gateway (FreedomPay) instead returns redirectUrl — the caller must send
// the browser there and poll getDepositStatus afterwards; nothing is
// final yet at this point. See backend's DepositsHandler.Pay.
export type PayDepositResponse =
  | { redirectUrl: string }
  | { id: string; status: string; matchStatus: string };

export function payDeposit(token: string, depositId: string): Promise<PayDepositResponse> {
  return apiFetch<PayDepositResponse>(`/deposits/${depositId}/pay`, {
    method: "POST",
    token,
  });
}

export interface DepositStatusResponse {
  id: string;
  status: DepositStatus;
  matchStatus: string;
}

// getDepositStatus is what the post-redirect "return" page polls — a
// browser coming back from a hosted payment page never means the payment
// succeeded by itself; only this server-verified status does.
export function getDepositStatus(token: string, depositId: string): Promise<DepositStatusResponse> {
  return apiFetch<DepositStatusResponse>(`/deposits/${depositId}/status`, { token });
}
