"use client";

import { Banknote, GitMerge, Snowflake, TrendingUpDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PriceConvergenceDiagram } from "@/components/exchange/PriceConvergenceDiagram";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ExchangeExplainer() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: TrendingUpDown,
      title: t("home.exchange.step1.title"),
      description: t("home.exchange.step1.description"),
    },
    {
      icon: GitMerge,
      title: t("home.exchange.step2.title"),
      description: t("home.exchange.step2.description"),
    },
    {
      icon: Banknote,
      title: t("home.exchange.step3.title"),
      description: t("home.exchange.step3.description"),
    },
    {
      icon: Snowflake,
      title: t("home.exchange.step4.title"),
      description: t("home.exchange.step4.description"),
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("home.exchange.eyebrow")}
          title={t("home.exchange.title")}
          description={t("home.exchange.description")}
        />

        <PriceConvergenceDiagram />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <step.icon size={20} strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
