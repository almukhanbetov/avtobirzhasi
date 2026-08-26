"use client";

import { Lock, ShieldCheck } from "lucide-react";
import type { Car } from "@/types/car";
import type { Seller } from "@/types/seller";
import { formatTenge } from "@/lib/format/money";
import { Button } from "@/components/ui/Button";
import { MatchIndicator } from "@/components/exchange/MatchIndicator";
import { PriceMovement } from "@/components/exchange/PriceMovement";
import { PhoneReveal } from "@/components/cars/PhoneReveal";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function VehiclePriceSidebar({
  car,
  seller,
}: {
  car: Car;
  seller: Seller;
}) {
  const { t } = useLanguage();

  if (car.isExchange && car.exchangeRole && car.dailyChangePercent) {
    const isSeller = car.exchangeRole === "seller";

    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">
            {isSeller ? t("price.currentSellerPrice") : t("price.currentBuyerOffer")}
          </span>
          <MatchIndicator />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[32px] font-semibold tracking-tight text-foreground">
            {formatTenge(car.price)}
          </span>
          <PriceMovement role={car.exchangeRole} percent={car.dailyChangePercent} />
        </div>

        <p className="border-t border-border pt-4 text-[14px] leading-relaxed text-muted-foreground">
          {isSeller ? t("price.sellerDecreasing") : t("price.buyerIncreasing")}{" "}
          {t("price.convergenceNote")}
        </p>

        <div className="flex items-start gap-2.5 rounded-xl bg-brand-light p-4 text-[13px] leading-relaxed text-brand-dark">
          <Lock size={16} className="mt-0.5 shrink-0" />
          {t("price.depositNotice")}
        </div>

        <Button href="/exchange" variant="secondary">
          {t("price.moreAboutExchange")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">{t("price.label")}</span>
        <span className="text-[32px] font-semibold tracking-tight text-foreground">
          {formatTenge(car.price)}
        </span>
      </div>

      <PhoneReveal phone={seller.phone} />

      <div className="flex items-center gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
        <ShieldCheck size={16} className="shrink-0 text-success" />
        {t("price.directDeal")}
      </div>

      <div className="text-[13px] text-muted-foreground">
        {seller.name} ·{" "}
        {seller.type === "dealer" ? t("seller.dealer") : t("seller.private")}
      </div>
    </div>
  );
}
