"use client";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function FinalCta() {
  const { t } = useLanguage();

  return (
    <section className="bg-brand py-20 sm:py-24">
      <Container className="flex flex-col items-center gap-8 text-center">
        <h2 className="max-w-2xl text-[32px] font-semibold tracking-tight text-white sm:text-[40px]">
          {t("home.finalCta.title")}
        </h2>
        <p className="max-w-xl text-lg text-white/85">
          {t("home.finalCta.description")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            href="/sell/new"
            size="lg"
            variant="secondary"
            className="border-transparent bg-white text-brand hover:bg-white/90"
          >
            {t("home.hero.sellCta")}
          </Button>
          <Button
            href="/exchange/new"
            size="lg"
            variant="ghost"
            className="border border-white/40 text-white hover:bg-white/10"
          >
            {t("home.buyingWays.way2.cta")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
