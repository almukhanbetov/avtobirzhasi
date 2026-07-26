"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronDown } from "lucide-react";
import { sortOptions } from "@/features/listings/filterCars";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <span className="relative inline-flex items-center">
      <ArrowUpDown
        size={15}
        className="pointer-events-none absolute left-3.5 text-muted-foreground"
      />
      <select
        aria-label="Сортировка"
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
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
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
