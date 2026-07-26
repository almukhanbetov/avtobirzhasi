import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { CarCard } from "@/components/cars/CarCard";
import { mockCars } from "@/lib/mock/cars";

export function FreshListings() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow="Свежие объявления"
            title="Актуальные автомобили"
            description="Новые и проверенные объявления со всего Казахстана."
          />
          <Button href="/cars" variant="secondary" className="shrink-0">
            Смотреть все
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {mockCars.slice(0, 8).map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      </Container>
    </section>
  );
}
