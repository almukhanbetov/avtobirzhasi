import type { Lang } from "@/lib/i18n/translations";

// Kazakh nouns don't inflect for count after a numeral the way Russian
// does (5 машина, not 5 машиналар) — a single invariant form is the
// grammatically correct rendering, not a missing feature.
export function pluralizeCars(count: number, lang: Lang): string {
  if (lang === "kz") return "көлік";

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return "автомобиль";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return "автомобиля";
  return "автомобилей";
}
