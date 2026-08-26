"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { ExchangeRole } from "@/types/car";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function PriceMovement({
  role,
  percent,
  className,
}: {
  role: ExchangeRole;
  percent: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const isSeller = role === "seller";
  const Icon = isSeller ? ArrowDown : ArrowUp;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-medium",
        isSeller ? "text-destructive" : "text-success",
        className,
      )}
    >
      <Icon size={14} strokeWidth={2.5} />
      {Math.abs(percent)}
      {t("exchange.perDay")}
    </span>
  );
}
