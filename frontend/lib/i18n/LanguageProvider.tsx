"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { translations, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const STORAGE_KEY = "avtobirzhasi_lang";

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "ru";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "kz" ? "kz" : "ru";
}

// Manual RU/KZ toggle, same shape as ThemeProvider — persists in
// localStorage, defaults to Russian (the site's language throughout,
// beyond the header/footer chrome this covers so far).
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always starts at "ru", matching the server (see
  // lib/theme/ThemeProvider.tsx for why: reading localStorage directly
  // here would make the first client render disagree with the
  // server-rendered text for any t()-translated label). The stored choice
  // is applied a beat later, once mounted.
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    // One-time bridge from localStorage into React state on mount — see
    // ThemeProvider's identical effect for why this one is a sanctioned
    // exception to "don't setState in an effect" (runs once, empty deps,
    // not a cascading pattern).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(getStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "kz" ? "kk" : "ru";
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next: Lang = prev === "kz" ? "ru" : "kz";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      const value = translations[lang][key];
      if (value === undefined) {
        console.warn(`Missing translation for "${key}" (${lang})`);
        return key;
      }
      return value;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
