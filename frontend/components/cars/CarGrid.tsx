import type { Car } from "@/types/car";
import { CarCard } from "@/components/cars/CarCard";

export function CarGrid({ cars }: { cars: Car[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {cars.map((car) => (
        <CarCard key={car.id} car={car} />
      ))}
    </div>
  );
}
