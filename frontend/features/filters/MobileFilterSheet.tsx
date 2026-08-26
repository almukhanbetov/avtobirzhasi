"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterForm } from "@/features/filters/FilterForm";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { CarFilters } from "@/features/listings/filterCars";

export function MobileFilterSheet({
  filters,
  activeCount,
}: {
  filters: CarFilters;
  activeCount: number;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const isFirstRender = useRef(true);

  // FilterForm now applies each choice immediately instead of on a
  // "Показать" submit, so there's no natural page reload left to close
  // this sheet the way a native form submission used to. Close it
  // ourselves whenever the URL's filters actually change.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setOpen(false);
  }, [searchParamsKey]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[14px] font-medium text-foreground"
      >
        <SlidersHorizontal size={16} />
        {t("filters.title")}
        {activeCount > 0 ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-border px-6 py-5">
            <span className="text-lg font-semibold text-foreground">
              {t("filters.title")}
            </span>
            <button
              type="button"
              aria-label={t("filters.closeAria")}
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-foreground"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <FilterForm values={filters} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
