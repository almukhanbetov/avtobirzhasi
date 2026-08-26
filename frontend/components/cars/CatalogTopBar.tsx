"use client";

import { SortSelect } from "@/features/filters/SortSelect";
import { MobileFilterSheet } from "@/features/filters/MobileFilterSheet";
import { pluralizeCars } from "@/lib/format/plural";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { CarFilters } from "@/features/listings/filterCars";

export function CatalogTopBar({
  resultCount,
  filters,
  activeFilterCount,
}: {
  resultCount: number;
  filters: CarFilters;
  activeFilterCount: number;
}) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[15px] font-medium text-muted-foreground">
        {resultCount} {pluralizeCars(resultCount, lang)}
      </span>
      <div className="flex items-center gap-3">
        <MobileFilterSheet filters={filters} activeCount={activeFilterCount} />
        <SortSelect value={filters.sort} />
      </div>
    </div>
  );
}
