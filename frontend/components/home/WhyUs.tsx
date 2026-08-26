"use client";

import { Eye, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function WhyUs() {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Sparkles,
      title: t("home.whyUs.benefit1.title"),
      description: t("home.whyUs.benefit1.description"),
    },
    {
      icon: ShieldCheck,
      title: t("home.whyUs.benefit2.title"),
      description: t("home.whyUs.benefit2.description"),
    },
    {
      icon: Eye,
      title: t("home.whyUs.benefit3.title"),
      description: t("home.whyUs.benefit3.description"),
    },
    {
      icon: Gauge,
      title: t("home.whyUs.benefit4.title"),
      description: t("home.whyUs.benefit4.description"),
    },
  ];

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          align="center"
          eyebrow={t("home.whyUs.eyebrow")}
          title={t("home.whyUs.title")}
        />

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex flex-col items-center gap-4 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand">
                <benefit.icon size={22} strokeWidth={2} />
              </span>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                {benefit.title}
              </h3>
              <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
