"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { regions, makes, years } from "@/lib/mock/cars";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import type { CarFilters } from "@/features/listings/filterCars";

const DEBOUNCE_MS = 400;

export function FilterForm({
  values,
  className,
}: {
  values: CarFilters;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selecting a value navigates right away — changing filters always
  // means the current page number is no longer valid, so drop it too.
  function applyParam(key: string, value: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyParamDebounced(key: string, value: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => applyParam(key, value), DEBOUNCE_MS);
  }

  // Text/number fields need local state so typing feels instant — the
  // actual navigation is debounced, but the displayed value can't wait for
  // that round trip. Selects don't need this: a click is already a single
  // discrete choice, so they're driven straight off `values`.
  const [model, setModel] = useState(values.model);
  const [priceFrom, setPriceFrom] = useState(values.priceFrom?.toString() ?? "");
  const [priceTo, setPriceTo] = useState(values.priceTo?.toString() ?? "");

  // Re-sync local state when the server-confirmed `values` prop changes
  // (e.g. after navigation, or a filter chip/reset elsewhere clears a
  // field) — adjusted during render rather than in an effect, per React's
  // "storing information from previous renders" pattern, so it applies in
  // the same paint instead of flashing the stale value for a frame.
  const [prevValues, setPrevValues] = useState(values);
  if (
    values.model !== prevValues.model ||
    values.priceFrom !== prevValues.priceFrom ||
    values.priceTo !== prevValues.priceTo
  ) {
    setPrevValues(values);
    setModel(values.model);
    setPriceFrom(values.priceFrom?.toString() ?? "");
    setPriceTo(values.priceTo?.toString() ?? "");
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-5">
        <Select
          label="Регион"
          value={values.region}
          onChange={(e) => applyParam("region", e.target.value)}
        >
          <option value="">Любой регион</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </Select>

        <Select
          label="Марка"
          value={values.make}
          onChange={(e) => applyParam("make", e.target.value)}
        >
          <option value="">Любая марка</option>
          {makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </Select>

        <Input
          label="Модель"
          placeholder="Например: Camry"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            applyParamDebounced("model", e.target.value);
          }}
        />

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            Год выпуска
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="от"
              value={values.yearFrom ?? ""}
              onChange={(e) => applyParam("yearFrom", e.target.value)}
            >
              <option value="">от</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              label="до"
              value={values.yearTo ?? ""}
              onChange={(e) => applyParam("yearTo", e.target.value)}
            >
              <option value="">до</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            Цена, ₸
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="от"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={priceFrom}
              onChange={(e) => {
                setPriceFrom(e.target.value);
                applyParamDebounced("priceFrom", e.target.value);
              }}
            />
            <Input
              label="до"
              type="number"
              inputMode="numeric"
              placeholder="50 000 000"
              value={priceTo}
              onChange={(e) => {
                setPriceTo(e.target.value);
                applyParamDebounced("priceTo", e.target.value);
              }}
            />
          </div>
        </div>

        <details
          className="group border-t border-border pt-5"
          open={Boolean(
            values.bodyType || values.transmission || values.drivetrain || values.fuelType,
          )}
        >
          <summary className="cursor-pointer list-none text-[15px] font-medium text-foreground marker:content-none">
            <span className="inline-flex items-center gap-1.5">
              Ещё фильтры
              <span className="text-muted-foreground transition-transform group-open:rotate-180">
                ⌄
              </span>
            </span>
          </summary>

          <div className="mt-5 flex flex-col gap-5">
            <Select
              label="Кузов"
              value={values.bodyType}
              onChange={(e) => applyParam("bodyType", e.target.value)}
            >
              <option value="">Любой кузов</option>
              {Object.entries(bodyTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label="Коробка"
              value={values.transmission}
              onChange={(e) => applyParam("transmission", e.target.value)}
            >
              <option value="">Любая коробка</option>
              {Object.entries(transmissionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label="Привод"
              value={values.drivetrain}
              onChange={(e) => applyParam("drivetrain", e.target.value)}
            >
              <option value="">Любой привод</option>
              {Object.entries(drivetrainLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label="Тип топлива"
              value={values.fuelType}
              onChange={(e) => applyParam("fuelType", e.target.value)}
            >
              <option value="">Любое топливо</option>
              {Object.entries(fuelTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </details>

        <div className="border-t border-border pt-5">
          <Link
            href="/cars"
            className="block text-center text-[15px] font-medium text-muted-foreground hover:text-foreground"
          >
            Сбросить фильтры
          </Link>
        </div>
      </div>
    </div>
  );
}
