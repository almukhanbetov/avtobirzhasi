"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { makes, modelsByMake, years } from "@/lib/mock/cars";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import { LocationSelector, EMPTY_LOCATION_VALUE, type LocationValue } from "@/features/location/LocationSelector";
import { listRegions, listCitiesByRegion, resolveLegacyRegionText } from "@/lib/api/locations";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { CarFilters } from "@/features/listings/filterCars";

const DEBOUNCE_MS = 400;

export function FilterForm({
  values,
  className,
}: {
  values: CarFilters;
  className?: string;
}) {
  const { lang, t } = useLanguage();
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

  // Марка → Модель: a make change always drops the now-possibly-invalid
  // model filter too — in one navigation, the same way applyLocationParams
  // below bundles a location change instead of pushing multiple times.
  function applyMakeChange(make: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    if (make) params.set("make", make);
    else params.delete("make");
    params.delete("model");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  // Stage 7А: an old ?region=<text> link (no regionId) is resolved once,
  // client-side only, purely so LocationSelector can *display* the right
  // selection — the URL itself is never rewritten just from viewing the
  // page (only an actual pick does that, via applyLocationParams below).
  const needsLegacyMatch = !values.regionId && !!values.region;
  const legacyMatchQuery = useQuery({
    queryKey: ["locations", "legacy-match", values.region],
    queryFn: () => resolveLegacyRegionText(values.region),
    enabled: needsLegacyMatch,
    staleTime: Infinity,
  });
  const effectiveLocation: LocationValue = values.regionId
    ? { regionId: values.regionId, cityId: values.cityId, districtId: values.districtId }
    : needsLegacyMatch && legacyMatchQuery.data
      ? { regionId: legacyMatchQuery.data.regionId, cityId: legacyMatchQuery.data.cityId, districtId: null }
      : EMPTY_LOCATION_VALUE;

  // Same derivation as ListingForm/RequestForm (Stage 5Б/6А): the legacy
  // `region` text kept in the URL (for FilterChips' display and for old
  // clients) is the selected city's name if any, else the region's.
  const regionsForTextQuery = useQuery({
    queryKey: ["locations", "regions"],
    queryFn: listRegions,
    staleTime: 5 * 60 * 1000,
  });
  const citiesForTextQuery = useQuery({
    queryKey: ["locations", "cities", effectiveLocation.regionId],
    queryFn: () => listCitiesByRegion(effectiveLocation.regionId as string),
    enabled: Boolean(effectiveLocation.regionId),
    staleTime: 5 * 60 * 1000,
  });

  // Unlike applyParam (one key at a time), a location change always
  // touches regionId/cityId/districtId (and the derived region text)
  // together in a single navigation — never three separate pushes for
  // one user action.
  function applyLocationParams(next: LocationValue) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("regionId", next.regionId);
    setOrDelete("cityId", next.cityId);
    setOrDelete("districtId", next.districtId);

    const regionName = regionsForTextQuery.data?.find((r) => r.id === next.regionId)?.nameRu ?? "";
    const cityName = citiesForTextQuery.data?.find((c) => c.id === next.cityId)?.nameRu ?? "";
    setOrDelete("region", cityName || regionName || null);

    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  // Text/number fields need local state so typing feels instant — the
  // actual navigation is debounced, but the displayed value can't wait for
  // that round trip. Selects don't need this (model included, now that
  // it's a Select rather than free text — Stage 8Б-5): a click is already
  // a single discrete choice, so they're driven straight off `values`.
  const [priceFrom, setPriceFrom] = useState(values.priceFrom?.toString() ?? "");
  const [priceTo, setPriceTo] = useState(values.priceTo?.toString() ?? "");

  // Re-sync local state when the server-confirmed `values` prop changes
  // (e.g. after navigation, or a filter chip/reset elsewhere clears a
  // field) — adjusted during render rather than in an effect, per React's
  // "storing information from previous renders" pattern, so it applies in
  // the same paint instead of flashing the stale value for a frame.
  const [prevValues, setPrevValues] = useState(values);
  if (values.priceFrom !== prevValues.priceFrom || values.priceTo !== prevValues.priceTo) {
    setPrevValues(values);
    setPriceFrom(values.priceFrom?.toString() ?? "");
    setPriceTo(values.priceTo?.toString() ?? "");
  }

  // Марка → Модель: same reference and fallback-preservation rule as
  // ListingForm/RequestForm — an old ?model= URL for a model outside the
  // curated list for the current make must still show as selected, not
  // silently vanish from the filter.
  const knownModels = values.make ? (modelsByMake[values.make] ?? []) : [];
  const modelOptions =
    values.model && !knownModels.includes(values.model) ? [values.model, ...knownModels] : knownModels;

  return (
    <div className={className}>
      <div className="flex flex-col gap-5">
        <LocationSelector
          value={effectiveLocation}
          onChange={applyLocationParams}
          regionPlaceholder={t("quickSearch.anyRegion")}
        />

        <Select
          label={t("quickSearch.make")}
          value={values.make}
          onChange={(e) => applyMakeChange(e.target.value)}
        >
          <option value="">{t("quickSearch.anyMake")}</option>
          {makes.map((make) => (
            <option key={make} value={make}>
              {make}
            </option>
          ))}
        </Select>

        <Select
          label={t("quickSearch.model")}
          value={values.model}
          disabled={!values.make}
          onChange={(e) => applyParam("model", e.target.value)}
        >
          <option value="">{t("quickSearch.anyModel")}</option>
          {modelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("listingForm.year")}
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("filters.from")}
              value={values.yearFrom ?? ""}
              onChange={(e) => applyParam("yearFrom", e.target.value)}
            >
              <option value="">{t("filters.from")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              label={t("filters.to")}
              value={values.yearTo ?? ""}
              onChange={(e) => applyParam("yearTo", e.target.value)}
            >
              <option value="">{t("filters.to")}</option>
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
            {t("listingForm.price")}
          </span>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("filters.from")}
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
              label={t("filters.to")}
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
              {t("filters.more")}
              <span className="text-muted-foreground transition-transform group-open:rotate-180">
                ⌄
              </span>
            </span>
          </summary>

          <div className="mt-5 flex flex-col gap-5">
            <Select
              label={t("specs.bodyType")}
              value={values.bodyType}
              onChange={(e) => applyParam("bodyType", e.target.value)}
            >
              <option value="">{t("filters.anyBodyType")}</option>
              {Object.entries(bodyTypeLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label={t("specs.transmission")}
              value={values.transmission}
              onChange={(e) => applyParam("transmission", e.target.value)}
            >
              <option value="">{t("filters.anyTransmission")}</option>
              {Object.entries(transmissionLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label={t("specs.drivetrain")}
              value={values.drivetrain}
              onChange={(e) => applyParam("drivetrain", e.target.value)}
            >
              <option value="">{t("filters.anyDrivetrain")}</option>
              {Object.entries(drivetrainLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Select
              label={t("listingForm.fuelType")}
              value={values.fuelType}
              onChange={(e) => applyParam("fuelType", e.target.value)}
            >
              <option value="">{t("filters.anyFuelType")}</option>
              {Object.entries(fuelTypeLabels[lang]).map(([value, label]) => (
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
            {t("emptyState.resetFilters")}
          </Link>
        </div>
      </div>
    </div>
  );
}
