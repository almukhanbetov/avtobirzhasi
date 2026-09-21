"use client";

import { Camera, TrendingDown, GitMerge, Banknote, Unlock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Stage 9Б-21: "Как проходит продажа" — five seller-facing steps, same
// card/grid/icon+number pattern as ExchangeSteps.tsx and
// BuyHowToSteps.tsx (not a new design). Wording verified against the
// actual backend implementation, not invented — see
// backend/internal/service/exchange.go (dailyRate = 0.01,
// matchTolerancePercent ≈2%, deposit = 1% of finalPrice) and
// MatchesHandler.Get (counterpart phone only once status == "confirmed").
export function SellSteps() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Camera,
      title: t("sell.steps.step1.title"),
      description: t("sell.steps.step1.description"),
    },
    {
      icon: TrendingDown,
      title: t("sell.steps.step2.title"),
      description: t("sell.steps.step2.description"),
    },
    {
      icon: GitMerge,
      title: t("sell.steps.step3.title"),
      description: t("sell.steps.step3.description"),
    },
    {
      icon: Banknote,
      title: t("sell.steps.step4.title"),
      description: t("sell.steps.step4.description"),
    },
    {
      icon: Unlock,
      title: t("sell.steps.step5.title"),
      description: t("sell.steps.step5.description"),
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader eyebrow={t("sell.steps.eyebrow")} title={t("sell.steps.title")} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 transition-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
