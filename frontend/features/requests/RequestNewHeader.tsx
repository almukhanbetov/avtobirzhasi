"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function RequestNewHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2 text-center">
      <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        {t("requestNew.title")}
      </h1>
      <p className="text-[15px] text-muted-foreground">
        {t("requestNew.description")}
      </p>
    </div>
  );
}
