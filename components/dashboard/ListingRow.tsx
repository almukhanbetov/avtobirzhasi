import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatTenge } from "@/lib/format/money";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import type { SellerListing } from "@/types/dashboard";

export function ListingRow({ listing }: { listing: SellerListing }) {
  const status = listingStatusLabels[listing.status];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-background sm:h-16 sm:w-24">
        <Image
          src={listing.car.imageUrl}
          alt={`${listing.car.make} ${listing.car.model}`}
          fill
          sizes="150px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <span className="text-[15px] font-semibold text-foreground">
            {listing.car.make} {listing.car.model}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">
          Обновлено{" "}
          {new Date(listing.updatedAt).toLocaleDateString("ru-RU")}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(listing.car.price)}
        </span>
        <Link
          href={`/cars/${listing.car.id}`}
          className="text-[14px] font-semibold text-brand hover:text-brand-dark"
        >
          Открыть
        </Link>
      </div>
    </div>
  );
}
