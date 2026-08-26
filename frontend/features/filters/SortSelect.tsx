"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { sortOptionValues, type SortOption } from "@/features/listings/filterCars";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";

const sortLabelKeys: Record<SortOption, TranslationKey> = {
  newest: "sort.newest",
  "price-asc": "sort.priceAsc",
  "price-desc": "sort.priceDesc",
  "year-desc": "sort.yearDesc",
};

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  return (
    <span className="relative inline-flex items-center">
      <ArrowUpDown
        size={15}
        className="pointer-events-none absolute left-3.5 text-muted-foreground"
      />
      <select
        aria-label={t("sort.ariaLabel")}
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("sort", event.target.value);
          params.delete("page");
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className="h-11 appearance-none rounded-xl border border-border bg-surface py-2 pl-9 pr-9 text-[14px] font-medium text-foreground transition-colors hover:border-foreground/30 focus:border-brand"
      >
        {sortOptionValues.map((option) => (
          <option key={option} value={option}>
            {t(sortLabelKeys[option])}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 text-muted-foreground"
      />
    </span>
  );
}
