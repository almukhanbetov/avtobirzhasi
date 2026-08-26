"use client";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ExchangeHero() {
  const { t } = useLanguage();

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-6 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-brand">
          {t("home.exchange.eyebrow")}
        </span>
        <h1 className="max-w-3xl text-[42px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[54px]">
          {t("exchange.hero.title")}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {t("exchange.hero.description")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="/sell/new" size="lg">
            {t("home.hero.sellCta")}
          </Button>
          <Button href="/exchange/new" variant="secondary" size="lg">
            {t("exchange.hero.buyRequestCta")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
