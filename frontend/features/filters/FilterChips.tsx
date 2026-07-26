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

export function FilterChips({
  filters,
  searchParams,
}: {
  filters: CarFilters;
  searchParams: RawSearchParams;
}) {
  const chips: { key: string; label: string }[] = [];

  if (filters.region) chips.push({ key: "region", label: filters.region });
  if (filters.make) chips.push({ key: "make", label: filters.make });
  if (filters.model) chips.push({ key: "model", label: filters.model });
  if (filters.yearFrom)
    chips.push({ key: "yearFrom", label: `от ${filters.yearFrom} г.` });
  if (filters.yearTo)
    chips.push({ key: "yearTo", label: `до ${filters.yearTo} г.` });
  if (filters.priceFrom)
    chips.push({
      key: "priceFrom",
      label: `от ${formatTenge(filters.priceFrom)}`,
    });
  if (filters.priceTo)
    chips.push({ key: "priceTo", label: `до ${formatTenge(filters.priceTo)}` });
  if (filters.bodyType)
    chips.push({
      key: "bodyType",
      label: bodyTypeLabels[filters.bodyType as keyof typeof bodyTypeLabels],
    });
  if (filters.transmission)
    chips.push({
      key: "transmission",
      label:
        transmissionLabels[
          filters.transmission as keyof typeof transmissionLabels
        ],
    });
  if (filters.drivetrain)
    chips.push({
      key: "drivetrain",
      label:
        drivetrainLabels[filters.drivetrain as keyof typeof drivetrainLabels],
    });
  if (filters.fuelType)
    chips.push({
      key: "fuelType",
      label: fuelTypeLabels[filters.fuelType as keyof typeof fuelTypeLabels],
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
        Сбросить всё
      </Link>
    </div>
  );
}
