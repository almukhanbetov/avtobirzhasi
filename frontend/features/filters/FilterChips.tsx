"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { buildHref, type RawSearchParams } from "@/lib/url/searchParams";
import type { CarFilters } from "@/features/listings/filterCars";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import { formatTenge } from "@/lib/format/money";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function FilterChips({
  filters,
  searchParams,
}: {
  filters: CarFilters;
  searchParams: RawSearchParams;
}) {
  const { lang, t } = useLanguage();
  const chips: { key: string; label: string }[] = [];

  if (filters.region) chips.push({ key: "region", label: filters.region });
  if (filters.make) chips.push({ key: "make", label: filters.make });
  if (filters.model) chips.push({ key: "model", label: filters.model });
  if (filters.yearFrom)
    chips.push({
      key: "yearFrom",
      label: `${t("filters.from")} ${filters.yearFrom} ${t("filters.yearSuffix")}`,
    });
  if (filters.yearTo)
    chips.push({
      key: "yearTo",
      label: `${t("filters.to")} ${filters.yearTo} ${t("filters.yearSuffix")}`,
    });
  if (filters.priceFrom)
    chips.push({
      key: "priceFrom",
      label: `${t("filters.from")} ${formatTenge(filters.priceFrom)}`,
    });
  if (filters.priceTo)
    chips.push({
      key: "priceTo",
      label: `${t("filters.to")} ${formatTenge(filters.priceTo)}`,
    });
  if (filters.bodyType)
    chips.push({
      key: "bodyType",
      label:
        bodyTypeLabels[lang][filters.bodyType as keyof (typeof bodyTypeLabels)[typeof lang]],
    });
  if (filters.transmission)
    chips.push({
      key: "transmission",
      label:
        transmissionLabels[lang][
          filters.transmission as keyof (typeof transmissionLabels)[typeof lang]
        ],
    });
  if (filters.drivetrain)
    chips.push({
      key: "drivetrain",
      label:
        drivetrainLabels[lang][
          filters.drivetrain as keyof (typeof drivetrainLabels)[typeof lang]
        ],
    });
  if (filters.fuelType)
    chips.push({
      key: "fuelType",
      label:
        fuelTypeLabels[lang][filters.fuelType as keyof (typeof fuelTypeLabels)[typeof lang]],
    });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={buildHref("/cars", searchParams, {
            [chip.key]: undefined,
            page: undefined,
          })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/30"
        >
          {chip.label}
          <X size={13} />
        </Link>
      ))}
      <Link
        href="/cars"
        className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        {t("filters.resetAll")}
      </Link>
    </div>
  );
}
