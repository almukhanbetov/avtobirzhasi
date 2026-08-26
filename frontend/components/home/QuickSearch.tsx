"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { makes, regions, years } from "@/lib/mock/cars";
import { formatTenge } from "@/lib/format/money";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function QuickSearch() {
  const { t } = useLanguage();
  const router = useRouter();

  const [region, setRegion] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [priceRange, setPriceRange] = useState("");

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
    if (region) params.set("region", region);
    if (make) params.set("make", make);
    if (model.trim()) params.set("model", model.trim());
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
            <Select
              label={t("quickSearch.region")}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">{t("quickSearch.anyRegion")}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>

            <Select
              label={t("quickSearch.make")}
              value={make}
              onChange={(e) => setMake(e.target.value)}
            >
              <option value="">{t("quickSearch.anyMake")}</option>
              {makes.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>

            <Input
              label={t("quickSearch.model")}
              placeholder="Camry"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />

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
