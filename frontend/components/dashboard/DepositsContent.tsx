"use client";

import { useState } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { DepositRow } from "@/components/dashboard/DepositRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyDeposits, payDeposit } from "@/lib/api/deposits";
import { ApiError } from "@/lib/api/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function DepositsContent() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "deposits"],
    queryFn: () => listMyDeposits(token as string),
    enabled: Boolean(token),
  });

  // Paying a deposit either resolves synchronously (mock provider — also
  // recomputes the parent Match's derived status and, once both sides
  // have paid, unlocks contacts server-side) or returns a redirectUrl for
  // a real gateway's hosted payment page — in that case the browser
  // leaves this page entirely and nothing is final until the return page
  // polls getDepositStatus. See lib/api/deposits.ts's payDeposit.
  const payMutation = useMutation({
    mutationFn: (depositId: string) => payDeposit(token as string, depositId),
    onSuccess: (result) => {
      setError(null);
      if ("redirectUrl" in result) {
        window.location.href = result.redirectUrl;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard", "deposits"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "matches"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("dashboard.deposits.payError"));
    },
  });

  const isMockMode = !data || data.every((deposit) => deposit.provider === "mock");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.deposits")}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("dashboard.deposits.subtitle")}
        </p>
      </div>

      {isMockMode ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-light p-4 text-[13px] leading-relaxed text-warning">
          <FlaskConical size={16} className="mt-0.5 shrink-0" />
          {t("dashboard.deposits.mockNotice")}
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl bg-success-light p-4 text-[13px] leading-relaxed text-success">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          {t("dashboard.deposits.realNotice")}
        </div>
      )}

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title={t("dashboard.deposits.loadErrorTitle")}
          description={t("cars.empty.error.description")}
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
          title={t("dashboard.deposits.emptyTitle")}
          description={t("dashboard.deposits.emptyDescription")}
        />
      )}
    </div>
  );
}
