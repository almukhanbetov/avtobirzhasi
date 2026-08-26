"use client";

import { useQuery } from "@tanstack/react-query";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { CarCard } from "@/components/cars/CarCard";
import { listCars } from "@/lib/api/cars";
import type { CarFilters } from "@/features/listings/filterCars";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// The catalog's own page size is 8 (backend/internal/handlers/cars.go),
// so "sort=newest, page=1" already returns exactly the freshest 8 active
// listings — no client-side slicing of a larger set needed.
const freshFilters: CarFilters = {
  region: "",
  make: "",
  model: "",
  yearFrom: null,
  yearTo: null,
  priceFrom: null,
  priceTo: null,
  bodyType: "",
  transmission: "",
  drivetrain: "",
  fuelType: "",
  sort: "newest",
  page: 1,
};

export function FreshListings() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cars", "fresh"],
    queryFn: () => listCars(freshFilters),
  });

  if (!isLoading && !isError && (!data || data.items.length === 0)) {
    // Nothing live to show yet (e.g. an empty catalog) — the section adds
    // no value over just not rendering it, unlike a filtered-search empty
    // state which needs to explain "why", so it's simplest to hide it.
    return null;
  }

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow={t("home.fresh.eyebrow")}
            title={t("home.fresh.title")}
            description={t("home.fresh.description")}
          />
          <Button href="/cars" variant="secondary" className="shrink-0">
            {t("home.fresh.viewAll")}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-[15px] text-muted-foreground">
            {t("cars.empty.error.description")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data!.items.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
