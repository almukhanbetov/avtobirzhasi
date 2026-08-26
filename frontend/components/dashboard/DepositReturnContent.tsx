"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDepositStatus } from "@/lib/api/deposits";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15; // ~30s — long enough for a webhook that's slightly delayed

// DepositReturnContent is where FreedomPay's hosted payment page redirects
// the browser back to. A browser return is never itself proof of payment
// (see Stage 11's requirement) — this page only ever displays whatever
// GET /api/deposits/:id/status says, polling it a few times in case the
// webhook hasn't landed yet.
export function DepositReturnContent() {
  const searchParams = useSearchParams();
  const depositId = searchParams.get("depositId");
  const { token } = useAuth();
  const { t } = useLanguage();
  // Incremented inside queryFn — an external-system callback invoked by
  // react-query's own fetch scheduling, not the render body or an effect
  // body — so this is the "calling setState in a callback function when
  // external state changes" pattern the lint rule asks for, not the
  // synchronous-in-effect pattern it forbids.
  const [attempts, setAttempts] = useState(0);

  const { data } = useQuery({
    queryKey: ["deposit-status", depositId],
    queryFn: () => {
      setAttempts((n) => n + 1);
      return getDepositStatus(token as string, depositId as string);
    },
    enabled: Boolean(token && depositId),
    refetchInterval: (query) => (query.state.data?.status === "pending" || !query.state.data ? POLL_INTERVAL_MS : false),
  });

  const status = data?.status;
  const timedOut = attempts >= MAX_ATTEMPTS && (!status || status === "pending");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      {!status || status === "pending" ? (
        timedOut ? (
          <>
            <XCircle size={40} className="text-warning" />
            <p className="text-[15px] text-foreground">{t("dashboard.deposits.return.timeout")}</p>
          </>
        ) : (
          <>
            <Loader2 size={40} className="animate-spin text-brand" />
            <p className="text-[17px] font-semibold text-foreground">
              {t("dashboard.deposits.return.verifying")}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {t("dashboard.deposits.return.verifyingDescription")}
            </p>
          </>
        )
      ) : status === "paid" ? (
        <>
          <CheckCircle2 size={40} className="text-success" />
          <p className="text-[17px] font-semibold text-foreground">
            {t("dashboard.deposits.return.success")}
          </p>
        </>
      ) : (
        <>
          <XCircle size={40} className="text-destructive" />
          <p className="text-[17px] font-semibold text-foreground">
            {t("dashboard.deposits.return.failed")}
          </p>
        </>
      )}

      <Link href="/dashboard/deposits" className="text-[13px] font-medium text-brand underline">
        {t("dashboard.deposits.return.backLink")}
      </Link>
    </div>
  );
}
