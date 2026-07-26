import type { Car } from "@/types/car";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  steeringWheelLabels,
  transmissionLabels,
} from "@/lib/labels/car";

export function SpecsGrid({ car }: { car: Car }) {
  const specs = [
    { label: "Год", value: String(car.year) },
    { label: "Пробег", value: `${car.mileageKm.toLocaleString("ru-RU")} км` },
    {
      label: "Двигатель",
      value: `${car.engineVolume.toFixed(1)} л · ${car.enginePower} л.с. · ${fuelTypeLabels[car.fuelType]}`,
    },
    { label: "Коробка", value: transmissionLabels[car.transmission] },
    { label: "Привод", value: drivetrainLabels[car.drivetrain] },
    { label: "Кузов", value: bodyTypeLabels[car.bodyType] },
    { label: "Цвет", value: car.color },
    { label: "Руль", value: steeringWheelLabels[car.steeringWheel] },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        Характеристики
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
