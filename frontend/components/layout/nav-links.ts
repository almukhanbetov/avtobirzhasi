import type { TranslationKey } from "@/lib/i18n/translations";

export const navLinks: { href: string; labelKey: TranslationKey }[] = [
  { href: "/cars", labelKey: "nav.cars" },
  { href: "/buy", labelKey: "nav.buy" },
  { href: "/sell", labelKey: "nav.sell" },
  { href: "/exchange", labelKey: "nav.exchange" },
  { href: "/how-it-works", labelKey: "nav.howItWorks" },
];
