import type { Car } from "@/types/car";
import { drivetrainLabels, transmissionLabels } from "@/lib/labels/car";
import { formatMileage } from "@/lib/format/money";

export function generateDescription(car: Car): string {
  return (
    `${car.make} ${car.model} ${car.year} года в хорошем состоянии. ` +
    `Пробег ${formatMileage(car.mileageKm)}, коробка передач — ${transmissionLabels[car.transmission].toLowerCase()}, ` +
    `привод — ${drivetrainLabels[car.drivetrain].toLowerCase()}. Кузов не крашен, все технические жидкости ` +
    `заменены по регламенту. Автомобиль готов к эксплуатации, возможен торг при осмотре.`
  );
}
