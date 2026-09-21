"use client";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Stage 9Б-21: the /sell landing page's first screen — same widescreen,
// image-free hero pattern already used by ExchangeHero (centered eyebrow-
// free title, description, single CTA), not a new design. The CTA links
// straight to the existing /sell/new form; that route's own RequireAuth
// wrapper is the project's actual auth gate (see RequireAuth's doc
// comment) — there is no "return to this page after login" mechanism
// anywhere in the project (LoginForm always sends an authenticated user
// to postAuthPath(), never back to where they came from), so this page
// doesn't invent one either.
export function SellHero() {
  const { t } = useLanguage();

  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h1 className="max-w-3xl text-[42px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[54px]">
          {t("sell.hero.title")}
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {t("sell.hero.description")}
        </p>
        <Button href="/sell/new" size="lg">
          {t("sell.hero.cta")}
        </Button>
      </Container>
    </section>
  );
}
