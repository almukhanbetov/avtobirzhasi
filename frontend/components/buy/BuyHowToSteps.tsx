"use client";

import { Car, QrCode, UserRound } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// The manual direct-purchase instructions shown on /buy, below the two
// BuyingWays cards. This is the "buy now at the current price" path: pick
// a car, pay a 1% deposit by QR, then get the seller's contact. It is a
// plain explainer — no backend, no Auto Exchange mechanics.
export function BuyHowToSteps() {
  const { t } = useLanguage();

  const steps = [
    {
      icon: Car,
      title: t("buy.howTo.step1.title"),
      description: t("buy.howTo.step1.description"),
    },
    {
      icon: QrCode,
      title: t("buy.howTo.step2.title"),
      description: t("buy.howTo.step2.description"),
    },
    {
      icon: UserRound,
      title: t("buy.howTo.step3.title"),
      description: t("buy.howTo.step3.description"),
    },
  ];

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("buy.howTo.eyebrow")}
          title={t("buy.howTo.title")}
          description={t("buy.howTo.subtitle")}
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
