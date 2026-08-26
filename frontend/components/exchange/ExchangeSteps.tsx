"use client";

import {
  Banknote,
  GitMerge,
  PencilLine,
  TrendingUpDown,
  Unlock,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ExchangeSteps() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: PencilLine,
      title: t("exchange.steps.step1.title"),
      description: t("exchange.steps.step1.description"),
    },
    {
      icon: TrendingUpDown,
      title: t("exchange.steps.step2.title"),
      description: t("exchange.steps.step2.description"),
    },
    {
      icon: GitMerge,
      title: t("exchange.steps.step3.title"),
      description: t("exchange.steps.step3.description"),
    },
    {
      icon: Banknote,
      title: t("exchange.steps.step4.title"),
      description: t("exchange.steps.step4.description"),
    },
    {
      icon: Unlock,
      title: t("exchange.steps.step5.title"),
      description: t("exchange.steps.step5.description"),
    },
  ];

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("exchange.steps.eyebrow")}
          title={t("exchange.steps.title")}
          description={t("exchange.steps.description")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-6"
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
