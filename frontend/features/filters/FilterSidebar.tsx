import { FilterForm } from "@/features/filters/FilterForm";
import type { CarFilters } from "@/features/listings/filterCars";

export function FilterSidebar({ filters }: { filters: CarFilters }) {
  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-28 rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 text-lg font-semibold tracking-tight text-foreground">
          Фильтры
        </h2>
        <FilterForm values={filters} />
      </div>
    </aside>
  );
}
