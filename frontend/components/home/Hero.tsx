"use client";

import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="bg-surface pb-24 pt-16 sm:pt-20">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-10">
          <div className="flex flex-col items-start gap-7">
            <span className="text-sm font-semibold uppercase tracking-wide text-brand">
              {t("home.hero.eyebrow")}
            </span>
            <h1 className="text-[42px] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[54px] lg:text-[64px]">
              {t("home.hero.title")}
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              {t("home.hero.description")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button href="/cars" size="lg">
                {t("home.hero.buyCta")}
              </Button>
              <Button href="/sell/new" variant="secondary" size="lg">
                {t("home.hero.sellCta")}
              </Button>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-background sm:aspect-[16/11]">
            <Image
              src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1600&q=80"
              alt={t("home.hero.imageAlt")}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
