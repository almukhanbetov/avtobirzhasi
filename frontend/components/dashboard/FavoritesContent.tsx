"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { CarGrid } from "@/components/cars/CarGrid";
import { CarCardSkeleton } from "@/components/cars/CarCardSkeleton";
import { useFavorites } from "@/lib/favorites/useFavorites";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function FavoritesContent() {
  const { favorites, isLoading, isError } = useFavorites();
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("header.favorites")}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("dashboard.favorites.subtitle")}
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
          title={t("dashboard.favorites.loadErrorTitle")}
          description={t("cars.empty.error.description")}
        />
      ) : favorites.length > 0 ? (
        <CarGrid cars={favorites} />
      ) : (
        <EmptyState
          title={t("dashboard.favorites.emptyTitle")}
          description={t("dashboard.favorites.emptyDescription")}
          secondaryHref="/cars"
          secondaryLabel={t("home.buyingWays.way1.cta")}
        />
      )}
    </div>
  );
}
