"use client";

import { FilterForm } from "@/features/filters/FilterForm";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { CarFilters } from "@/features/listings/filterCars";

export function FilterSidebar({ filters }: { filters: CarFilters }) {
  const { t } = useLanguage();

  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-28 rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 text-lg font-semibold tracking-tight text-foreground">
          {t("filters.title")}
        </h2>
        <FilterForm values={filters} />
      </div>
    </aside>
  );
}
