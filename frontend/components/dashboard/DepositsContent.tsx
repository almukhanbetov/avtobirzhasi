"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { DepositRow } from "@/components/dashboard/DepositRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyDeposits, payDeposit } from "@/lib/api/deposits";
import { ApiError } from "@/lib/api/client";

export function DepositsContent() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "deposits"],
    queryFn: () => listMyDeposits(token as string),
    enabled: Boolean(token),
  });

  // Paying a deposit also recomputes the parent Match's derived status
  // server-side (and, once both sides have paid, unlocks contacts) — see
  // lib/api/deposits.ts's payDeposit. Invalidate both queries so the
  // Matches page reflects it without a manual refresh.
  const payMutation = useMutation({
    mutationFn: (depositId: string) => payDeposit(token as string, depositId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard", "deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "matches"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Не удалось внести депозит");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Депозиты
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Депозит 1% подтверждает серьёзность намерений и открывает контакты
          после Match.
        </p>
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить депозиты"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((deposit) => (
            <DepositRow
              key={deposit.id}
              deposit={deposit}
              onPay={() => payMutation.mutate(deposit.id)}
              isPaying={payMutation.isPending && payMutation.variables === deposit.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Депозитов пока нет."
          description="Депозит появится здесь, как только по вашему объявлению или заявке будет найден Match."
        />
      )}
    </div>
  );
}
