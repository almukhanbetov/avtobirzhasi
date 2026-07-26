import { Skeleton } from "@/components/ui/Skeleton";

// Shared loading placeholder for ListingRow/RequestRow — both are the
// same shape (image-or-icon block, two-line label, price + link).
export function RowSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <Skeleton className="h-40 w-full shrink-0 rounded-xl sm:h-16 sm:w-24" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}
