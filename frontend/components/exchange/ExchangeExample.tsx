"use client";

import Image from "next/image";
import { GitMerge, MapPin, Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PriceMovement } from "@/components/exchange/PriceMovement";
import { formatTenge } from "@/lib/format/money";
import { mockCars } from "@/lib/mock/cars";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function ExchangeExample() {
  const { t } = useLanguage();
  const sellerCar = mockCars.find((car) => car.id === "car-2")!;
  const buyerOffer = 11_400_000;

  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow={t("exchange.example.eyebrow")}
          title={t("exchange.example.title")}
          description={t("exchange.example.description")}
        />

        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-background">
              <Image
                src={sellerCar.imageUrl}
                alt={`${sellerCar.make} ${sellerCar.model}`}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 p-6">
              <span className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("exchange.example.sellerListing")}
              </span>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[18px] font-semibold tracking-tight text-foreground">
                  {sellerCar.make} {sellerCar.model}
                </h3>
                <span className="text-[15px] text-muted-foreground">
                  {sellerCar.year}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin size={14} />
                {sellerCar.region}
              </span>
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  {formatTenge(sellerCar.price)}
                </span>
                <PriceMovement role="seller" percent={1} />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-brand-light px-5 py-4 text-center">
              <GitMerge size={20} className="text-brand" />
              <span className="text-[13px] font-semibold text-brand-dark">
                {t("exchange.example.gapPercent")}
              </span>
              <span className="text-[12px] text-brand-dark/80">
                {t("exchange.example.untilMatch")}
              </span>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex aspect-[16/10] w-full items-center justify-center bg-brand-light">
              <Search size={40} className="text-brand" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col gap-3 p-6">
              <span className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("exchange.example.buyerRequest")}
              </span>
              <h3 className="text-[18px] font-semibold tracking-tight text-foreground">
                {sellerCar.make} {sellerCar.model}, {sellerCar.year - 1}–
                {sellerCar.year + 1}
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin size={14} />
                {sellerCar.region} {t("exchange.example.neighboringRegions")}
              </span>
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xl font-semibold tracking-tight text-foreground">
                  {formatTenge(buyerOffer)}
                </span>
                <PriceMovement role="buyer" percent={1} />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
