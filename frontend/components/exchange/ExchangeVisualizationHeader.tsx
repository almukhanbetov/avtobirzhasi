"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ExchangeVisualizationHeader() {
  const { t } = useLanguage();

  return (
    <SectionHeader
      align="center"
      eyebrow={t("exchange.page.visualizationEyebrow")}
      title={t("exchange.page.visualizationTitle")}
      description={t("exchange.page.visualizationDescription")}
    />
  );
}
