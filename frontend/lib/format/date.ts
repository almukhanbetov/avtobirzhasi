import type { Lang } from "@/lib/i18n/translations";

function localeFor(lang: Lang): string {
  return lang === "kz" ? "kk-KZ" : "ru-RU";
}

export function formatDateTime(date: string | Date, lang: Lang): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatShortDate(date: string | Date, lang: Lang): string {
  return new Date(date).toLocaleDateString(localeFor(lang));
}
