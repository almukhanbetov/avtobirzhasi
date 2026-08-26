import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { CarGrid } from "@/components/cars/CarGrid";
import { CatalogTopBar } from "@/components/cars/CatalogTopBar";
import { Pagination } from "@/components/ui/Pagination";
import { CarsPageHeader } from "@/components/cars/CarsPageHeader";
import { CarsEmptyFiltered, CarsEmptyError } from "@/components/cars/CarsEmptyState";
import { FilterSidebar } from "@/features/filters/FilterSidebar";
import { FilterChips } from "@/features/filters/FilterChips";
import { listCars, type CarsListResponse } from "@/lib/api/cars";
import { countActiveFilters, parseCarFilters } from "@/features/listings/filterCars";
import type { RawSearchParams } from "@/lib/url/searchParams";

export const metadata: Metadata = {
  title: "Автомобили — AVTOBIRZHASI.KZ",
  description:
    "Каталог автомобилей в Казахстане: фильтры по региону, марке, цене и году выпуска.",
};

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const filters = parseCarFilters(rawSearchParams);

  let result: CarsListResponse | null = null;
  try {
    result = await listCars(filters);
  } catch {
    result = null;
  }

  return (
    <div className="py-12 sm:py-16">
      <Container className="flex flex-col gap-8">
        <CarsPageHeader />

        {result ? (
          <>
            <CatalogTopBar
              resultCount={result.total}
              filters={filters}
              activeFilterCount={countActiveFilters(filters)}
            />

            <FilterChips filters={filters} searchParams={rawSearchParams} />

            <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
              <FilterSidebar filters={filters} />

              <div className="flex flex-1 flex-col gap-10">
                {result.items.length > 0 ? (
                  <CarGrid cars={result.items} />
                ) : (
                  <CarsEmptyFiltered />
                )}

                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  pathname="/cars"
                  searchParams={rawSearchParams}
                />
              </div>
            </div>
          </>
        ) : (
          <CarsEmptyError />
        )}
      </Container>
    </div>
  );
}
