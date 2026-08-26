"use client";

import type { Car } from "@/types/car";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  steeringWheelLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function SpecsGrid({ car }: { car: Car }) {
  const { lang, t } = useLanguage();

  const specs = [
    { label: t("specs.year"), value: String(car.year) },
    { label: t("specs.mileage"), value: `${car.mileageKm.toLocaleString("ru-RU")} км` },
    {
      label: t("specs.engine"),
      value: `${car.engineVolume.toFixed(1)} л · ${car.enginePower} л.с. · ${fuelTypeLabels[lang][car.fuelType]}`,
    },
    { label: t("specs.transmission"), value: transmissionLabels[lang][car.transmission] },
    { label: t("specs.drivetrain"), value: drivetrainLabels[lang][car.drivetrain] },
    { label: t("specs.bodyType"), value: bodyTypeLabels[lang][car.bodyType] },
    { label: t("specs.color"), value: car.color },
    { label: t("specs.steeringWheel"), value: steeringWheelLabels[lang][car.steeringWheel] },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {t("specs.title")}
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {specs.map((spec) => (
          <div key={spec.label} className="flex flex-col gap-1">
            <span className="text-[13px] text-muted-foreground">
              {spec.label}
            </span>
            <span className="text-[15px] font-medium text-foreground">
              {spec.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
