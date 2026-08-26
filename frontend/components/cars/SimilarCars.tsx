"use client";

import type { Car } from "@/types/car";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { CarGrid } from "@/components/cars/CarGrid";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// cars is already the filtered, limited-to-4 list from
// GET /api/cars/:id/similar — see lib/api/cars.ts's getSimilarCars.
export function SimilarCars({ cars }: { cars: Car[] }) {
  const { t } = useLanguage();

  if (cars.length === 0) return null;

  return (
    <section className="flex flex-col gap-8">
      <SectionHeader
        title={t("similarCars.title")}
        description={t("similarCars.description")}
      />
      <CarGrid cars={cars} />
    </section>
  );
}
