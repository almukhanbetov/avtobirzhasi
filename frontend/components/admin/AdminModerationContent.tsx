"use client";

import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatTenge } from "@/lib/format/money";
import { approveListing, listPendingListings, rejectListing } from "@/lib/api/moderation";
import { ApiError } from "@/lib/api/client";

const PENDING_KEY = ["admin", "pending-listings"];

export function AdminModerationContent() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: listPendingListings,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_KEY }),
  });

  const actionError = approveMutation.error ?? rejectMutation.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Модерация объявлений
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Внутренний инструмент — доступен только с этой же машины, где
          запущен бэкенд (см. middleware.LocalOnly на сервере).
        </p>
      </div>

      {actionError ? (
        <p className="text-[13px] text-destructive">
          {actionError instanceof ApiError
            ? actionError.message
            : "Не удалось обработать объявление"}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить очередь модерации"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
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
                    {listing.isExchange ? " · Автобиржа" : ""}
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
                      {isRejecting ? "Отклоняем…" : "Отклонить"}
                    </Button>
                    <Button
                      size="md"
                      onClick={() => approveMutation.mutate(listing.id)}
                      disabled={isBusy}
                    >
                      {isApproving ? "Одобряем…" : "Одобрить"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Очередь модерации пуста."
          description="Новые объявления появятся здесь сразу после размещения."
        />
      )}
    </div>
  );
}
