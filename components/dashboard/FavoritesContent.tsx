"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { CarGrid } from "@/components/cars/CarGrid";
import { CarCardSkeleton } from "@/components/cars/CarCardSkeleton";
import { useFavorites } from "@/lib/favorites/useFavorites";

export function FavoritesContent() {
  const { favorites, isLoading, isError } = useFavorites();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Избранное
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Автомобили, которые вы сохранили для сравнения.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <CarCardSkeleton />
          <CarCardSkeleton />
          <CarCardSkeleton />
          <CarCardSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить избранное"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : favorites.length > 0 ? (
        <CarGrid cars={favorites} />
      ) : (
        <EmptyState
          title="В избранном пока пусто."
          description="Нажимайте на сердечко на карточке автомобиля, чтобы сохранить его здесь."
          secondaryHref="/cars"
          secondaryLabel="Смотреть автомобили"
        />
      )}
    </div>
  );
}
