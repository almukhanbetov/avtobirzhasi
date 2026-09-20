"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { makes, modelsByMake, years } from "@/lib/mock/cars";
import { formatTenge } from "@/lib/format/money";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import {
  LocationSelector,
  EMPTY_LOCATION_VALUE,
  type LocationValue,
} from "@/features/location/LocationSelector";
import { listRegions, listCitiesByRegion } from "@/lib/api/locations";

export function QuickSearch() {
  const { t } = useLanguage();
  const router = useRouter();

  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION_VALUE);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [priceRange, setPriceRange] = useState("");

  // Stage 7Б: the legacy `region` text travels alongside regionId, same
  // derivation as the catalog's own FilterForm (Stage 7А) — so /cars gets
  // the exact same two-param contract regardless of which page the user
  // searched from, and FilterChips/old clients on /cars keep working.
  const regionsQuery = useQuery({
    queryKey: ["locations", "regions"],
    queryFn: listRegions,
    staleTime: 5 * 60 * 1000,
  });
  const citiesQuery = useQuery({
    queryKey: ["locations", "cities", location.regionId],
    queryFn: () => listCitiesByRegion(location.regionId as string),
    enabled: Boolean(location.regionId),
    staleTime: 5 * 60 * 1000,
  });

  const prices = [
    { label: `${t("filters.to")} ${formatTenge(5000000)}`, value: "0-5000000" },
    {
      label: `${formatTenge(5000000)} – ${formatTenge(10000000)}`,
      value: "5000000-10000000",
    },
    {
      label: `${formatTenge(10000000)} – ${formatTenge(20000000)}`,
      value: "10000000-20000000",
    },
    { label: `${t("filters.from")} ${formatTenge(20000000)}`, value: "20000000-" },
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const params = new URLSearchParams();
    if (location.regionId) params.set("regionId", location.regionId);
    if (location.cityId) params.set("cityId", location.cityId);
    if (location.districtId) params.set("districtId", location.districtId);
    const regionName = regionsQuery.data?.find((r) => r.id === location.regionId)?.nameRu ?? "";
    const cityName = citiesQuery.data?.find((c) => c.id === location.cityId)?.nameRu ?? "";
    const regionText = cityName || regionName;
    if (regionText) params.set("region", regionText);
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (year) params.set("yearFrom", year);
    if (priceRange) {
      const [from, to] = priceRange.split("-");
      if (from) params.set("priceFrom", from);
      if (to) params.set("priceTo", to);
    }

    const query = params.toString();
    router.push(query ? `/cars?${query}` : "/cars");
  }

  return (
    <section className="relative z-10 -mt-20">
      <Container>
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.8fr_1.2fr_auto] lg:items-end">
            <LocationSelector
              value={location}
              onChange={setLocation}
              regionPlaceholder={t("quickSearch.anyRegion")}
            />

            <Select
              label={t("quickSearch.make")}
              value={make}
              onChange={(e) => {
                setMake(e.target.value);
                setModel("");
              }}
            >
              <option value="">{t("quickSearch.anyMake")}</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <Select
              label={t("quickSearch.model")}
              value={model}
              disabled={!make}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">{t("quickSearch.anyModel")}</option>
              {(modelsByMake[make] ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <Select
              label={t("quickSearch.year")}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">{t("quickSearch.anyYear")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>

            <Select
              label={t("quickSearch.price")}
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
            >
              <option value="">{t("quickSearch.anyPrice")}</option>
              {prices.map((price) => (
                <option key={price.value} value={price.value}>
                  {price.label}
                </option>
              ))}
            </Select>

            <Button type="submit" size="lg" className="w-full lg:w-auto">
              <Search size={18} />
              {t("quickSearch.submit")}
            </Button>
          </div>
        </form>
      </Container>
    </section>
  );
}
