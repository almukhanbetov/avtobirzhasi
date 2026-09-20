"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  listRegions,
  listCitiesByRegion,
  listDistrictsByCity,
  type LocationRegion,
} from "@/lib/api/locations";

// A controlled region -> city -> district cascade backed by the Stage 4
// Go API (GET /api/regions, /api/regions/:id/cities,
// /api/cities/:id/districts). Built only from the existing <Select> UI
// component — no new design.
//
// Restoring a saved value: the caller passes previously-saved UUIDs in
// `value`; each level's query is keyed off the id one level up
// (["locations","cities", regionId], ["locations","districts", cityId]),
// so as soon as that data arrives the matching <option> is already
// selected — no separate "restore" step, and no reverse (city -> region)
// lookup is needed since the caller is expected to hold both ids.
//
// Stale-response protection: each dependent query's cache key includes
// the parent id it was fetched for, so if the user reselects the region
// before the previous cities request resolves, that in-flight response
// lands under its own (now-abandoned) key — the component only ever
// renders the query for the CURRENT regionId/cityId, never a straggler.
//
// Republican-significance regions (Astana/Almaty/Shymkent, kind =
// "republican_city") have exactly one city — the city itself (see
// docs/LOCATION_IMPLEMENTATION.md Stage 2/3). Once that city loads, it is
// adopted automatically and no city <Select> is rendered — the user is
// never asked to pick the one city a second time.
export interface LocationValue {
  regionId: string | null;
  cityId: string | null;
  districtId: string | null;
}

export const EMPTY_LOCATION_VALUE: LocationValue = {
  regionId: null,
  cityId: null,
  districtId: null,
};

function localizedName(item: { nameRu: string; nameKz: string }, lang: "ru" | "kz"): string {
  return lang === "kz" ? item.nameKz : item.nameRu;
}

export function LocationSelector({
  value,
  onChange,
  disabled,
  regionPlaceholder,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  disabled?: boolean;
  // Overrides the region <option value=""> label — every existing caller
  // keeps "Выберите регион" (nothing passed); a catalog filter (Stage
  // 7А), where no selection means "any region" rather than "you must
  // choose one", passes t("quickSearch.anyRegion") instead. No other
  // behavior changes.
  regionPlaceholder?: string;
}) {
  const { lang, t } = useLanguage();

  const regionsQuery = useQuery({
    queryKey: ["locations", "regions"],
    queryFn: listRegions,
    staleTime: 5 * 60 * 1000,
  });

  const citiesQuery = useQuery({
    queryKey: ["locations", "cities", value.regionId],
    queryFn: () => listCitiesByRegion(value.regionId as string),
    enabled: Boolean(value.regionId),
    staleTime: 5 * 60 * 1000,
  });

  const districtsQuery = useQuery({
    queryKey: ["locations", "districts", value.cityId],
    queryFn: () => listDistrictsByCity(value.cityId as string),
    enabled: Boolean(value.cityId),
    staleTime: 5 * 60 * 1000,
  });

  const regions: LocationRegion[] = regionsQuery.data ?? [];
  const selectedRegion = regions.find((r) => r.id === value.regionId) ?? null;
  // Only trust isSpecial once the regions list has actually loaded, so a
  // republican region doesn't briefly render an (empty) city picker.
  const isRepublicanCity = regionsQuery.isSuccess && (selectedRegion?.isSpecial ?? false);

  const cities = citiesQuery.data ?? [];
  const districts = districtsQuery.data ?? [];
  const selectedCity = cities.find((c) => c.id === value.cityId) ?? null;

  // Adopt a republican-significance region's single city automatically.
  useEffect(() => {
    if (!isRepublicanCity) return;
    const onlyCity = cities[0];
    if (onlyCity && value.cityId !== onlyCity.id) {
      onChange({ ...value, cityId: onlyCity.id, districtId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRepublicanCity, cities]);

  function handleRegionChange(regionId: string) {
    onChange({ regionId: regionId || null, cityId: null, districtId: null });
  }

  function handleCityChange(cityId: string) {
    onChange({ ...value, cityId: cityId || null, districtId: null });
  }

  function handleDistrictChange(districtId: string) {
    onChange({ ...value, districtId: districtId || null });
  }

  return (
    <div className="flex flex-col gap-4">
      <Select
        label={t("quickSearch.region")}
        value={value.regionId ?? ""}
        disabled={disabled || regionsQuery.isLoading}
        onChange={(e) => handleRegionChange(e.target.value)}
      >
        <option value="">{regionPlaceholder ?? t("listingForm.chooseRegion")}</option>
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {localizedName(region, lang)}
          </option>
        ))}
      </Select>
      {regionsQuery.isError ? (
        <p className="text-[13px] text-destructive">{t("locationSelector.loadError")}</p>
      ) : null}

      {value.regionId && regionsQuery.isSuccess && !isRepublicanCity ? (
        <>
          <Select
            label={t("locationSelector.city")}
            value={value.cityId ?? ""}
            disabled={disabled || citiesQuery.isLoading}
            onChange={(e) => handleCityChange(e.target.value)}
          >
            <option value="">{t("locationSelector.chooseCity")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {localizedName(city, lang)}
              </option>
            ))}
          </Select>
          {citiesQuery.isError ? (
            <p className="text-[13px] text-destructive">{t("locationSelector.loadError")}</p>
          ) : null}
        </>
      ) : null}

      {isRepublicanCity && selectedCity ? (
        <p className="text-[13px] text-muted-foreground">
          {t("locationSelector.city")}: {localizedName(selectedCity, lang)}
        </p>
      ) : null}

      {value.cityId && districts.length > 0 ? (
        <Select
          label={t("locationSelector.district")}
          value={value.districtId ?? ""}
          disabled={disabled || districtsQuery.isLoading}
          onChange={(e) => handleDistrictChange(e.target.value)}
        >
          <option value="">{t("locationSelector.chooseDistrict")}</option>
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {localizedName(district, lang)}
            </option>
          ))}
        </Select>
      ) : null}
      {value.cityId && districtsQuery.isError ? (
        <p className="text-[13px] text-destructive">{t("locationSelector.loadError")}</p>
      ) : null}
    </div>
  );
}
