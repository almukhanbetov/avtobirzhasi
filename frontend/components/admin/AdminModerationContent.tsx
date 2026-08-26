"use client";

import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTenge } from "@/lib/format/money";
import { approveListing, listPendingListings, rejectListing } from "@/lib/api/moderation";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const PENDING_KEY = ["admin", "pending-listings"];

export function AdminModerationContent() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => listPendingListings(token!),
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveListing(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectListing(id, token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  });

  const actionError = approveMutation.error ?? rejectMutation.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("admin.moderation.title")}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("admin.moderation.subtitle")}
        </p>
      </div>

      {actionError ? (
        <p className="text-[13px] text-destructive">
          {actionError instanceof ApiError
            ? actionError.message
            : t("admin.moderation.genericError")}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState
          title={t("admin.moderation.loadErrorTitle")}
          description={t("cars.empty.error.description")}
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((listing) => {
            const isApproving =
              approveMutation.isPending && approveMutation.variables === listing.id;
            const isRejecting =
              rejectMutation.isPending && rejectMutation.variables === listing.id;
            const isBusy = isApproving || isRejecting;

            return (
              <div
                key={listing.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
              >
                <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-background sm:h-20 sm:w-28">
                  <Image
                    src={listing.imageUrl}
                    alt={`${listing.make} ${listing.model}`}
                    fill
                    sizes="150px"
                    className="object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <span className="text-[15px] font-semibold text-foreground">
                    {listing.make} {listing.model} {listing.year}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {listing.region} · {listing.sellerName}
                    {listing.isExchange ? ` · ${t("home.exchange.eyebrow")}` : ""}
                  </span>
                </div>

                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-[17px] font-semibold tracking-tight text-foreground">
                    {formatTenge(listing.price)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="md"
                      variant="secondary"
                      onClick={() => rejectMutation.mutate(listing.id)}
                      disabled={isBusy}
                    >
                      {isRejecting ? t("admin.moderation.rejecting") : t("admin.moderation.reject")}
                    </Button>
                    <Button
                      size="md"
                      onClick={() => approveMutation.mutate(listing.id)}
                      disabled={isBusy}
                    >
                      {isApproving ? t("admin.moderation.approving") : t("admin.moderation.approve")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("admin.moderation.emptyTitle")}
          description={t("admin.moderation.emptyDescription")}
        />
      )}
    </div>
  );
}
