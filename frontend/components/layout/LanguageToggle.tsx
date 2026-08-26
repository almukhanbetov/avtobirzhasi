"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, toggleLang } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={lang === "kz" ? "Орыс тіліне ауысу" : "Переключить на казахский"}
      className={
        className ??
        "flex h-11 items-center justify-center rounded-xl px-3 text-[14px] font-semibold text-foreground/70 transition-colors hover:bg-black/[0.04] hover:text-foreground"
      }
    >
      {lang === "kz" ? "РУС" : "ҚАЗ"}
    </button>
  );
}
