import { apiFetch } from "@/lib/api/client";
import type { Deposit } from "@/types/dashboard";

export function listMyDeposits(token: string): Promise<Deposit[]> {
  return apiFetch<Deposit[]>("/dashboard/deposits", { token });
}

interface PayDepositResponse {
  id: string;
  status: string;
  matchStatus: string;
}

// payDeposit is the mock "pay" action — see backend's DepositService.Pay:
// it also recomputes the parent match's derived status and, once both
// sides have paid, unlocks contacts. Callers should invalidate both the
// deposits and matches queries after this succeeds.
export function payDeposit(token: string, depositId: string): Promise<PayDepositResponse> {
  return apiFetch<PayDepositResponse>(`/deposits/${depositId}/pay`, {
    method: "POST",
    token,
  });
}
