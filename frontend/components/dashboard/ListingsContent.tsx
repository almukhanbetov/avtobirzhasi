"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListingRow } from "@/components/dashboard/ListingRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyListings } from "@/lib/api/listings";

export function ListingsContent() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "listings"],
    queryFn: () => listMyListings(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Мои объявления
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Объявления о продаже, которые вы разместили.
          </p>
        </div>
        <Button href="/sell/new">Продать автомобиль</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить объявления"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="У вас пока нет объявлений о продаже."
          description="Разместите автомобиль — Автобиржа сама подберёт покупателя по вашей цене."
          secondaryHref="/sell/new"
          secondaryLabel="Продать автомобиль"
        />
      )}
    </div>
  );
}
