"use client";

import { Star } from "lucide-react";
import type { Seller } from "@/types/seller";
import { Badge } from "@/components/ui/Badge";
import { PhoneReveal } from "@/components/cars/PhoneReveal";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SellerCard({ seller }: { seller: Seller }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {t("seller.title")}
      </h2>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-light text-lg font-semibold text-brand">
            {initials(seller.name)}
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="text-[16px] font-semibold text-foreground">
              {seller.name}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <Badge variant="outline">
                {seller.type === "dealer" ? t("seller.dealer") : t("seller.private")}
              </Badge>
              <span>
                {t("seller.since")} {seller.since}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[14px]">
          <Star size={16} className="fill-warning text-warning" />
          <span className="font-semibold text-foreground">
            {seller.rating.toFixed(1)}
          </span>
          <span className="text-muted-foreground">
            ({seller.reviewsCount} {t("seller.reviewsSuffix")})
          </span>
        </div>
      </div>

      <div className="sm:max-w-xs">
        <PhoneReveal phone={seller.phone} />
      </div>
    </div>
  );
}
