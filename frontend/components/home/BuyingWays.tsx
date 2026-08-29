"use client";

import { ArrowRight, GitMerge, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Deposit phone for the direct "buy now at the current price" flow.
// Digits-only for the tel: href; the spaced form is display-only.
const DEPOSIT_PHONE = "+77027897120";
const DEPOSIT_PHONE_DISPLAY = "+7 702 789 71 20";

// `withQrDeposit` is only set on the /buy page: it drops the Halyk QR
// payment area into the left ("Купить сейчас по текущей цене") card. The
// homepage renders <BuyingWays /> with no prop, so nothing changes there.
export function BuyingWays({ withQrDeposit = false }: { withQrDeposit?: boolean }) {
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
      qr: withQrDeposit,
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
      qr: false,
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

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
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

              {way.qr ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background p-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:text-left">
                  {/* Plain, eager <img>: served straight from /public, a QR
                      must not be re-encoded or lazy-loaded. White padding
                      keeps it readable on the dark card. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/halyk-qr.jpg"
                    alt={t("buy.qr.imageAlt")}
                    width={595}
                    height={842}
                    loading="eager"
                    decoding="sync"
                    className="block h-auto w-[180px] max-w-full shrink-0 rounded-lg bg-white object-contain p-2 shadow-sm sm:w-[210px]"
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-[14px] font-medium leading-snug text-foreground">
                      {t("buy.qr.text")}
                    </span>
                    <a
                      href={`tel:${DEPOSIT_PHONE}`}
                      className="inline-flex items-center gap-2 self-center text-[17px] font-semibold text-brand hover:text-brand-dark sm:self-start"
                    >
                      <Phone size={16} strokeWidth={2} />
                      {DEPOSIT_PHONE_DISPLAY}
                    </a>
                  </div>
                </div>
              ) : null}

              <Link
                href={way.href}
                className="mt-auto inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
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
