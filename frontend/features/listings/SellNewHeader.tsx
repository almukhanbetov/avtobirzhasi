"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function SellNewHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        {t("home.hero.sellCta")}
      </h1>
      <p className="text-[15px] text-muted-foreground">
        {t("sellNew.description")}
      </p>
    </div>
  );
}
