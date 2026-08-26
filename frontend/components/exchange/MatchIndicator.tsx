"use client";

import { GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function MatchIndicator({ className }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-brand-light px-2.5 py-1 text-[13px] font-medium text-brand-dark",
        className,
      )}
    >
      <GitMerge size={14} strokeWidth={2.5} />
      {t("home.exchange.eyebrow")}
    </span>
  );
}
