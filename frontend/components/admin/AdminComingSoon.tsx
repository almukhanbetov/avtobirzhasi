"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";

export function AdminComingSoon({ titleKey }: { titleKey: TranslationKey }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        {t(titleKey)}
      </h1>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-[15px] text-muted-foreground">
        {t("admin.comingSoon")}
      </div>
    </div>
  );
}
