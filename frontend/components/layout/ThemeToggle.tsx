"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      aria-pressed={isDark}
      className={
        className ??
        "flex h-11 w-11 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-black/[0.04] hover:text-foreground"
      }
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
