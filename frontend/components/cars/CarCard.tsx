"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Gauge, ImageOff, MapPin } from "lucide-react";
import type { Car } from "@/types/car";
import { formatMileage, formatTenge } from "@/lib/format/money";
import { transmissionLabels } from "@/lib/labels/car";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { isTrustedImageUrl, resolveImageUrl } from "@/lib/images/trustedImageUrl";
import { MatchIndicator } from "@/components/exchange/MatchIndicator";
import { PriceMovement } from "@/components/exchange/PriceMovement";
import { FavoriteButton } from "@/components/cars/FavoriteButton";

export function CarCard({ car }: { car: Car }) {
  const { lang } = useLanguage();
  const title = `${car.make} ${car.model}`;
  // A stored /uploads/ URL from an earlier local backend run can point
  // at a port the current one isn't on (Step 2, "Восстановление
  // настоящих фотографий") — resolved to the currently configured
  // origin before anything else touches it. A no-op for every other
  // kind of URL (Unsplash, production, already-correct).
  const resolvedImageUrl = resolveImageUrl(car.imageUrl);
  // Some listings carry an empty, malformed, or untrusted (not in
  // next.config.js's images.remotePatterns) photo URL — next/image
  // throws a hard runtime error for those, crashing the whole page
  // rather than just this card. Fall back to a plain placeholder instead.
  const hasTrustedImage = isTrustedImageUrl(resolvedImageUrl);
  // A URL can be on the trusted host allowlist yet still not actually
  // load (wrong port for this environment, a deleted upload, a network
  // hiccup — Stage 8В-1: a real listing's stored /uploads/ URL pointed
  // at a port nothing here serves). next/image doesn't throw for that —
  // the browser just fails the request — so this is the runtime
  // counterpart to hasTrustedImage: caught via onError, not upfront.
  //
  // Tracked as *which URL* failed, not a bare boolean (Step 4 bug:
  // a boolean never clears once set, so once one src failed the
  // placeholder stuck around forever — even across a dev hot-reload
  // that fixed the resolved URL underneath it, since the same component
  // instance keeps its hook state). Comparing against the current
  // resolvedImageUrl means a genuinely different (or since-repaired) URL
  // gets a fresh chance to load; the exact same URL failing again still
  // correctly keeps the placeholder.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage = hasTrustedImage && resolvedImageUrl !== failedImageUrl;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-foreground/25">
      <Link
        href={`/cars/${car.id}`}
        className="absolute inset-0 z-10"
        aria-label={title}
      />

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-background">
        {showImage ? (
          <Image
            src={resolvedImageUrl as string}
            alt={title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setFailedImageUrl(resolvedImageUrl)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff size={32} aria-hidden="true" />
          </div>
        )}
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
