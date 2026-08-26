"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/layout/Logo";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { TranslationKey } from "@/lib/i18n/translations";

const columns: {
  titleKey: TranslationKey;
  links: { href: string; labelKey: TranslationKey }[];
}[] = [
  {
    titleKey: "footer.buyers",
    links: [
      { href: "/cars", labelKey: "footer.allCars" },
      { href: "/buy", labelKey: "footer.buyNow" },
      { href: "/exchange", labelKey: "footer.buyViaExchange" },
      { href: "/dashboard/favorites", labelKey: "footer.favorites" },
    ],
  },
  {
    titleKey: "footer.sellers",
    links: [
      { href: "/sell/new", labelKey: "footer.postAd" },
      { href: "/sell", labelKey: "footer.howToSellFaster" },
      { href: "/how-it-works", labelKey: "footer.howItWorks" },
    ],
  },
  {
    titleKey: "footer.company",
    links: [
      { href: "/about", labelKey: "footer.about" },
      { href: "/safety", labelKey: "footer.safety" },
      { href: "/contacts", labelKey: "footer.contacts" },
    ],
  },
];

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="grid grid-cols-1 gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-[15px] text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>

        {columns.map((column) => (
          <div key={column.titleKey} className="flex flex-col gap-4">
            <span className="text-[15px] font-semibold text-foreground">
              {t(column.titleKey)}
            </span>
            <nav className="flex flex-col gap-3">
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </Container>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{t("footer.rights")}</span>
          <span>{t("footer.country")}</span>
        </Container>
      </div>
    </footer>
  );
}
