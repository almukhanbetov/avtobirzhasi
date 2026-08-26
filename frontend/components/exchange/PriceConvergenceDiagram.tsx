"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function PriceConvergenceDiagram() {
  const { t } = useLanguage();

  return (
    <div className="relative w-full rounded-2xl border border-border bg-surface p-6 sm:p-10">
      <svg
        viewBox="0 0 720 220"
        className="h-auto w-full"
        role="img"
        aria-label={t("exchange.diagram.ariaLabel")}
      >
        <line
          x1="0"
          y1="200"
          x2="720"
          y2="200"
          stroke="var(--border)"
          strokeWidth="1"
        />

        <path
          d="M 30 40 L 560 108"
          fill="none"
          stroke="var(--destructive)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 30 180 L 560 108"
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        <line
          x1="560"
          y1="108"
          x2="560"
          y2="200"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <circle cx="30" cy="40" r="5" fill="var(--destructive)" />
        <circle cx="30" cy="180" r="5" fill="var(--success)" />
        <circle
          cx="560"
          cy="108"
          r="7"
          fill="var(--brand)"
          stroke="white"
          strokeWidth="2"
        />

        <text
          x="30"
          y="24"
          fill="var(--foreground)"
          fontSize="15"
          fontWeight="600"
        >
          {t("exchange.diagram.seller")}
        </text>
        <text
          x="30"
          y="205"
          fill="var(--foreground)"
          fontSize="15"
          fontWeight="600"
        >
          {t("exchange.diagram.buyer")}
        </text>
        <text
          x="497"
          y="90"
          fill="var(--brand-dark)"
          fontSize="15"
          fontWeight="700"
        >
          Match ≈2%
        </text>
      </svg>
    </div>
  );
}
