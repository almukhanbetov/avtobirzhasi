"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function CarsEmptyFiltered() {
  const { t } = useLanguage();

  return (
    <EmptyState
      title={t("cars.empty.filtered.title")}
      description={t("cars.empty.filtered.description")}
      resetHref="/cars"
      secondaryHref="/exchange/new"
      secondaryLabel={t("home.buyingWays.way2.cta")}
    />
  );
}

export function CarsEmptyError() {
  const { t } = useLanguage();

  return (
    <EmptyState
      title={t("cars.empty.error.title")}
      description={t("cars.empty.error.description")}
      resetHref="/cars"
    />
  );
}
