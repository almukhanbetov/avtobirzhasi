"use client";

import Image from "next/image";
import Link from "next/link";
import { Gauge, MapPin } from "lucide-react";
import type { Car } from "@/types/car";
import { formatMileage, formatTenge } from "@/lib/format/money";
import { transmissionLabels } from "@/lib/labels/car";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { MatchIndicator } from "@/components/exchange/MatchIndicator";
import { PriceMovement } from "@/components/exchange/PriceMovement";
import { FavoriteButton } from "@/components/cars/FavoriteButton";

export function CarCard({ car }: { car: Car }) {
  const { lang } = useLanguage();
  const title = `${car.make} ${car.model}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-foreground/25">
      <Link
        href={`/cars/${car.id}`}
        className="absolute inset-0 z-10"
        aria-label={title}
      />

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-background">
        <Image
          src={car.imageUrl}
          alt={title}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {car.isExchange ? (
          <div className="absolute left-3 top-3">
            <MatchIndicator />
          </div>
        ) : null}
        <FavoriteButton
          carId={car.id}
          label={title}
          className="absolute right-3 top-3 z-20"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          <span className="text-[15px] text-muted-foreground">
            {car.year}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Gauge size={14} />
            {formatMileage(car.mileageKm)}
          </span>
          <span>{transmissionLabels[lang][car.transmission]}</span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} />
            {car.region}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-xl font-semibold tracking-tight text-foreground">
            {formatTenge(car.price)}
          </span>
          {car.isExchange && car.exchangeRole && car.dailyChangePercent ? (
            <PriceMovement
              role={car.exchangeRole}
              percent={car.dailyChangePercent}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
