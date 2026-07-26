import { Skeleton } from "@/components/ui/Skeleton";

export function CarCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-4 w-full max-w-56" />
        <div className="mt-1 flex items-center justify-between border-t border-border pt-4">
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    </div>
  );
}
