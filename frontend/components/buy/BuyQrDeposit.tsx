"use client";

import { Phone } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Deposit phone for the manual direct-purchase flow. Digits-only for the
// tel: href; the pretty form is only for display.
const DEPOSIT_PHONE = "+77027897120";
const DEPOSIT_PHONE_DISPLAY = "+7 702 789 71 20";

// The QR deposit block on /buy. The Halyk QR card
// (frontend/public/images/halyk-qr.jpg, 595x842) sits on its own white
// tile — a QR must stay high-contrast — wrapped in the site's normal dark
// card so it doesn't read as a foreign screenshot.
//
// A plain <img> on purpose: the file is served straight from /public and
// needs no optimization (a QR must not be re-encoded), so next/image
// would only add a lazy-load + a "color:transparent" placeholder state
// for zero benefit. width/height give the intrinsic ratio; `h-auto
// w-full` scales it to the tile without distorting it.
export function BuyQrDeposit() {
  const { t } = useLanguage();

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-2xl border border-border bg-surface p-6 text-center sm:p-12">
          <div className="flex flex-col gap-3">
            <h2 className="text-[26px] font-semibold tracking-tight text-foreground sm:text-[30px]">
              {t("buy.qr.title")}
            </h2>
            <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {t("buy.qr.text")}
            </p>
          </div>

          <div className="w-full max-w-[260px] rounded-2xl bg-white p-3 shadow-sm sm:max-w-[320px] sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/halyk-qr.jpg"
              alt={t("buy.qr.imageAlt")}
              width={595}
              height={842}
              className="block h-auto w-full rounded-lg"
            />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[14px] text-muted-foreground">
              {t("buy.qr.callAfter")}
            </span>
            <a
              href={`tel:${DEPOSIT_PHONE}`}
              className="inline-flex items-center gap-2 text-[19px] font-semibold text-brand hover:text-brand-dark"
            >
              <Phone size={18} strokeWidth={2} />
              {DEPOSIT_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
