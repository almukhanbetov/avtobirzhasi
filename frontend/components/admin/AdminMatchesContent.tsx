"use client";

import { useState } from "react";
import { GitMerge } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { matchStatusLabels } from "@/lib/labels/dashboard";
import { listAdminMatches } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { MatchStatus } from "@/types/dashboard";

const STATUSES: MatchStatus[] = [
  "awaiting_deposit",
  "seller_deposit_paid",
  "buyer_deposit_paid",
  "confirmed",
  "expired",
  "cancelled",
];

// Match status doesn't carry a Badge variant in lib/labels/dashboard.ts
// (only a plain label) — a small local map is simpler than changing that
// shared label source just for this read-only admin view.
const STATUS_VARIANT: Record<MatchStatus, "success" | "warning" | "brand" | "neutral"> = {
  awaiting_deposit: "warning",
  seller_deposit_paid: "brand",
  buyer_deposit_paid: "brand",
  confirmed: "success",
  expired: "neutral",
  cancelled: "neutral",
};

export function AdminMatchesContent() {
  const { t, lang } = useLanguage();
  const { token } = useAuth();
  const [status, setStatus] = useState<MatchStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "matches", status, page],
    queryFn: () => listAdminMatches(token!, { status: status || undefined, page }),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.matches")}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t("admin.matches.subtitle")}</p>
      </div>

      <div className="max-w-xs">
        <Select
          label={t("admin.filter.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MatchStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.filter.anyStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {matchStatusLabels[lang][s]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState title={t("admin.matches.loadErrorTitle")} description={t("cars.empty.error.description")} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {data.items.map((match) => (
              <div
                key={match.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <GitMerge size={20} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] text-muted-foreground">{match.id.slice(0, 8)}</span>
                    <Badge variant={STATUS_VARIANT[match.status]}>{matchStatusLabels[lang][match.status]}</Badge>
                  </div>
                  <span className="text-[13px] text-muted-foreground">
                    {t("admin.matches.deposits")}:{" "}
                    {match.sellerDepositPaid ? "✓" : "—"} / {match.buyerDepositPaid ? "✓" : "—"} ·{" "}
                    {formatShortDate(match.createdAt, lang)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[16px] font-semibold text-foreground">{formatTenge(match.finalPrice)}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {t("admin.matches.deposit")}: {formatTenge(match.depositAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <AdminPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} disabled={isLoading} />
        </>
      ) : (
        <EmptyState title={t("admin.matches.emptyTitle")} description={t("admin.matches.emptyDescription")} />
      )}
    </div>
  );
}
