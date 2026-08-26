"use client";

import type { Car } from "@/types/car";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function DescriptionSection({ car }: { car: Car }) {
  const { t } = useLanguage();
  const description = car.description?.trim();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {t("description.title")}
      </h2>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {description || t("description.empty")}
      </p>
    </div>
  );
}
