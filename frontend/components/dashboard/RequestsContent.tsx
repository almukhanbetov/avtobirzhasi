"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestRow } from "@/components/dashboard/RequestRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyRequests } from "@/lib/api/requests";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function RequestsContent() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "requests"],
    queryFn: () => listMyRequests(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            {t("dashboard.nav.requests")}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {t("dashboard.requests.subtitle")}
          </p>
        </div>
        <Button href="/exchange/new">{t("dashboard.requests.createCta")}</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title={t("dashboard.requests.loadErrorTitle")}
          description={t("cars.empty.error.description")}
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.requests.emptyTitle")}
          description={t("dashboard.requests.emptyDescription")}
          secondaryHref="/exchange/new"
          secondaryLabel={t("dashboard.requests.createCta")}
        />
      )}
    </div>
  );
}
