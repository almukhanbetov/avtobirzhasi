"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, GitMerge, LayoutGrid, Users, Wallet } from "lucide-react";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminStats } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

function StatBreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
          >
            <span className="text-[14px] text-muted-foreground">{row.label}</span>
            <span className="text-[14px] font-semibold text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardContent() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => getAdminStats(token!),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Dashboard
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("admin.stats.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-[15px] text-muted-foreground">
          {t("admin.stats.loadError")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard icon={Users} label={t("admin.stats.users")} value={data.users} />
            <SummaryCard
              icon={LayoutGrid}
              label={t("admin.stats.listings")}
              value={data.listings.total}
            />
            <SummaryCard
              icon={FileText}
              label={t("dashboard.nav.requests")}
              value={data.buyerRequests.total}
            />
            <SummaryCard icon={GitMerge} label={t("dashboard.nav.matches")} value={data.matches.total} />
            <SummaryCard icon={Wallet} label={t("dashboard.nav.deposits")} value={data.deposits.total} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatBreakdownCard
              title={t("admin.stats.listings")}
              rows={[
                { label: t("admin.stats.listings.active"), value: data.listings.active },
                { label: t("admin.stats.listings.moderation"), value: data.listings.moderation },
                { label: t("admin.stats.listings.frozen"), value: data.listings.frozen },
                { label: t("admin.stats.listings.archived"), value: data.listings.archived },
                { label: t("admin.stats.listings.exchange"), value: data.listings.exchange },
              ]}
            />
            <StatBreakdownCard
              title={t("dashboard.nav.matches")}
              rows={[
                { label: t("admin.stats.matches.awaitingDeposit"), value: data.matches.awaitingDeposit },
                { label: t("admin.stats.matches.partiallyPaid"), value: data.matches.partiallyPaid },
                { label: t("admin.stats.matches.confirmed"), value: data.matches.confirmed },
                { label: t("admin.stats.matches.expired"), value: data.matches.expired },
                { label: t("admin.stats.matches.cancelled"), value: data.matches.cancelled },
              ]}
            />
            <StatBreakdownCard
              title={t("dashboard.nav.deposits")}
              rows={[
                { label: t("admin.stats.deposits.pending"), value: data.deposits.pending },
                { label: t("admin.stats.deposits.paid"), value: data.deposits.paid },
                { label: t("admin.stats.deposits.refunded"), value: data.deposits.refunded },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
