"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { depositStatusLabels } from "@/lib/labels/dashboard";
import { listAdminDeposits } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { DepositStatus } from "@/types/dashboard";

const STATUSES: DepositStatus[] = ["pending", "paid", "refunded"];

export function AdminDepositsContent() {
  const { t, lang } = useLanguage();
  const { token } = useAuth();
  const [status, setStatus] = useState<DepositStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "deposits", status, page],
    queryFn: () => listAdminDeposits(token!, { status: status || undefined, page }),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.deposits")}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t("admin.deposits.subtitle")}</p>
      </div>

      <div className="max-w-xs">
        <Select
          label={t("admin.filter.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DepositStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.filter.anyStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {depositStatusLabels[lang][s].label}
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
        <EmptyState title={t("admin.deposits.loadErrorTitle")} description={t("cars.empty.error.description")} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {data.items.map((deposit) => {
              const statusInfo = depositStatusLabels[lang][deposit.status];
              return (
                <div
                  key={deposit.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                    <Wallet size={20} />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[13px] text-muted-foreground">{deposit.id.slice(0, 8)}</span>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <span className="text-[13px] text-muted-foreground">
                      {deposit.role} · {deposit.provider} · {formatShortDate(deposit.createdAt, lang)}
                    </span>
                  </div>
                  <span className="text-[16px] font-semibold text-foreground">{formatTenge(deposit.amount)}</span>
                </div>
              );
            })}
          </div>
          <AdminPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} disabled={isLoading} />
        </>
      ) : (
        <EmptyState title={t("admin.deposits.emptyTitle")} description={t("admin.deposits.emptyDescription")} />
      )}
    </div>
  );
}
