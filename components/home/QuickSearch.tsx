import { Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { makes, regions, years } from "@/lib/mock/cars";

const prices = [
  { label: "до 5 000 000 ₸", value: "0-5000000" },
  { label: "5 000 000 – 10 000 000 ₸", value: "5000000-10000000" },
  { label: "10 000 000 – 20 000 000 ₸", value: "10000000-20000000" },
  { label: "от 20 000 000 ₸", value: "20000000-" },
];

export function QuickSearch() {
  return (
    <section className="relative z-10 -mt-20">
      <Container>
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.8fr_1.2fr_auto] lg:items-end">
            <Select label="Регион" defaultValue="">
              <option value="" disabled>
                Любой регион
              </option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>

            <Select label="Марка" defaultValue="">
              <option value="" disabled>
                Любая марка
              </option>
              {makes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </Select>

            <Select label="Модель" defaultValue="">
              <option value="" disabled>
                Любая модель
              </option>
              <option value="camry">Camry</option>
              <option value="tucson">Tucson</option>
              <option value="rio">Rio</option>
            </Select>

            <Select label="Год" defaultValue="">
              <option value="" disabled>
                Любой
              </option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>

            <Select label="Цена" defaultValue="">
              <option value="" disabled>
                Любая цена
              </option>
              {prices.map((price) => (
                <option key={price.value} value={price.value}>
                  {price.label}
                </option>
              ))}
            </Select>

            <Button href="/cars" size="lg" className="w-full lg:w-auto">
              <Search size={18} />
              Найти
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
