import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { CarCardSkeleton } from "@/components/cars/CarCardSkeleton";

export default function CarsLoading() {
  return (
    <div className="py-12 sm:py-16">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-5 w-72" />
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-40" />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
          <div className="hidden w-[300px] shrink-0 lg:block">
            <Skeleton className="h-[560px] w-full rounded-2xl" />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <CarCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
