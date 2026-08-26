"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListingRow } from "@/components/dashboard/ListingRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyListings } from "@/lib/api/listings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ListingsContent() {
  const { token } = useAuth();
  const { t } = useLanguage();
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
            {t("dashboard.nav.listings")}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {t("dashboard.listings.subtitle")}
          </p>
        </div>
        <Button href="/sell/new">{t("home.hero.sellCta")}</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title={t("dashboard.listings.loadErrorTitle")}
          description={t("cars.empty.error.description")}
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.listings.emptyTitle")}
          description={t("dashboard.listings.emptyDescription")}
          secondaryHref="/sell/new"
          secondaryLabel={t("home.hero.sellCta")}
        />
      )}
    </div>
  );
}
