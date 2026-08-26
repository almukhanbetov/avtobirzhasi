"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function CarsPageHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[38px]">
        {t("nav.cars")}
      </h1>
      <p className="text-[15px] text-muted-foreground">{t("cars.subtitle")}</p>
    </div>
  );
}
