"use client";

import { ArrowRight, GitMerge, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function BuyingWays() {
  const { t } = useLanguage();

  const ways = [
    {
      icon: ShoppingBag,
      title: t("home.buyingWays.way1.title"),
      description: t("home.buyingWays.way1.description"),
      points: [
        t("home.buyingWays.way1.point1"),
        t("home.buyingWays.way1.point2"),
        t("home.buyingWays.way1.point3"),
        t("home.buyingWays.way1.point4"),
      ],
      href: "/cars",
      cta: t("home.buyingWays.way1.cta"),
    },
    {
      icon: GitMerge,
      title: t("home.buyingWays.way2.title"),
      description: t("home.buyingWays.way2.description"),
      points: [
        t("home.buyingWays.way2.point1"),
        t("home.buyingWays.way2.point2"),
        t("home.buyingWays.way2.point3"),
      ],
      href: "/exchange",
      cta: t("home.buyingWays.way2.cta"),
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("home.buyingWays.eyebrow")}
          title={t("home.buyingWays.title")}
          description={t("home.buyingWays.description")}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {ways.map((way) => (
            <div
              key={way.title}
              className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-8 sm:p-10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand">
                <way.icon size={24} strokeWidth={2} />
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  {way.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  {way.description}
                </p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {way.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-[15px] text-foreground"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={way.href}
                className="mt-2 inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
              >
                {way.cta}
                <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
