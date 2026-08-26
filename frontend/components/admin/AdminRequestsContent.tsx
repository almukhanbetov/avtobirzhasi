"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { formatTenge } from "@/lib/format/money";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import { archiveAdminRequest, listAdminRequests } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ListingStatus } from "@/types/dashboard";

const STATUSES: ListingStatus[] = ["active", "frozen", "archived"];

export function AdminRequestsContent() {
  const { t, lang } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "requests", status, page],
    queryFn: () => listAdminRequests(token!, { status: status || undefined, page }),
    enabled: !!token,
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveAdminRequest(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "requests"] }),
  });

  function handleArchive(id: string) {
    if (window.confirm(t("admin.requests.archiveConfirm"))) {
      archiveMutation.mutate(id);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.requests")}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t("admin.requests.subtitle")}</p>
      </div>

      <div className="max-w-xs">
        <Select
          label={t("admin.filter.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ListingStatus | "");
            setPage(1);
          }}
        >
          <option value="">{t("admin.filter.anyStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {listingStatusLabels[lang][s].label}
            </option>
          ))}
        </Select>
      </div>

      {archiveMutation.error ? (
        <p className="text-[13px] text-destructive">
          {archiveMutation.error instanceof ApiError
            ? archiveMutation.error.message
            : t("admin.moderation.genericError")}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState title={t("admin.requests.loadErrorTitle")} description={t("cars.empty.error.description")} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {data.items.map((request) => {
              const isArchiving = archiveMutation.isPending && archiveMutation.variables === request.id;
              const statusInfo = listingStatusLabels[lang][request.status];
              return (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
                >
                  <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-xl bg-brand-light sm:w-24">
                    <Search size={22} className="text-brand" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[15px] font-semibold text-foreground">
                        {request.make} {request.model}, {request.yearFrom}–{request.yearTo}
                      </span>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <span className="text-[13px] text-muted-foreground">
                      {request.region} · {request.buyerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <span className="text-[16px] font-semibold text-foreground">
                      {formatTenge(request.currentOffer)}
                    </span>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleArchive(request.id)}
                      disabled={isArchiving || request.status === "archived"}
                    >
                      {isArchiving ? t("admin.listings.archiving") : t("admin.listings.archive")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <AdminPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} disabled={isLoading} />
        </>
      ) : (
        <EmptyState title={t("admin.requests.emptyTitle")} description={t("admin.requests.emptyDescription")} />
      )}
    </div>
  );
}
