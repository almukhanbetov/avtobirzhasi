import type { Car } from "@/types/car";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CarGrid } from "@/components/cars/CarGrid";

// cars is already the filtered, limited-to-4 list from
// GET /api/cars/:id/similar — see lib/api/cars.ts's getSimilarCars.
export function SimilarCars({ cars }: { cars: Car[] }) {
  if (cars.length === 0) return null;

  return (
    <section className="flex flex-col gap-8">
      <SectionHeader
        title="Похожие автомобили"
        description="Другие варианты, которые могут вам подойти."
      />
      <CarGrid cars={cars} />
    </section>
  );
}
