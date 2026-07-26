import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Gallery } from "@/components/cars/Gallery";
import { SpecsGrid } from "@/components/cars/SpecsGrid";
import { DescriptionSection } from "@/components/cars/DescriptionSection";
import { SellerCard } from "@/components/cars/SellerCard";
import { VehiclePriceSidebar } from "@/components/cars/VehiclePriceSidebar";
import { SimilarCars } from "@/components/cars/SimilarCars";
import { FavoriteButton } from "@/components/cars/FavoriteButton";
import { getCar, getSimilarCars } from "@/lib/api/cars";
import { getSeller } from "@/lib/api/sellers";
import { ApiError } from "@/lib/api/client";
import { formatMileage, formatTenge } from "@/lib/format/money";
import type { Car } from "@/types/car";

async function findCar(id: string): Promise<Car | null> {
  try {
    return await getCar(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const car = await findCar(id);
  if (!car) return {};

  return {
    title: `${car.make} ${car.model} ${car.year} — ${formatTenge(car.price)} | AVTOBIRZHASI.KZ`,
    description: `${car.make} ${car.model} ${car.year} года, пробег ${formatMileage(car.mileageKm)}, ${car.region}.`,
  };
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const car = await findCar(id);
  if (!car) notFound();

  const [seller, similarCars] = await Promise.all([
    getSeller(car.sellerId),
    getSimilarCars(id),
  ]);
  const title = `${car.make} ${car.model}`;

  return (
    <div className="py-10 sm:py-14">
      <Container className="flex flex-col gap-10">
        <Link
          href="/cars"
          className="inline-flex w-fit items-center gap-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Все автомобили
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[38px]">
              {title} {car.year}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted-foreground">
              <span>{car.year}</span>
              <span>{formatMileage(car.mileageKm)}</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                {car.region}
              </span>
            </div>
          </div>

          <FavoriteButton
            carId={car.id}
            label={title}
            className="h-12 w-12 border border-border bg-surface"
          />
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <div className="order-2 flex flex-1 flex-col gap-10 lg:order-1">
            <Gallery images={car.images} title={title} />
            <SpecsGrid car={car} />
            <DescriptionSection car={car} />
            <SellerCard seller={seller} />
          </div>

          <div className="order-1 lg:order-2 lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-28">
              <VehiclePriceSidebar car={car} seller={seller} />
            </div>
          </div>
        </div>

        <SimilarCars cars={similarCars} />
      </Container>
    </div>
  );
}
