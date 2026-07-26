import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatTenge } from "@/lib/format/money";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import type { BuyerRequest } from "@/types/dashboard";

export function RequestRow({ request }: { request: BuyerRequest }) {
  const status = listingStatusLabels[request.status];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-xl bg-brand-light sm:w-24">
        <Search size={22} className="text-brand" />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <span className="text-[15px] font-semibold text-foreground">
            {request.make} {request.model}, {request.yearFrom}–
            {request.yearTo}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {request.region} · обновлено{" "}
          {new Date(request.updatedAt).toLocaleDateString("ru-RU")}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(request.currentOffer)}
        </span>
        <Link
          href="/exchange"
          className="text-[14px] font-semibold text-brand hover:text-brand-dark"
        >
          Подробнее
        </Link>
      </div>
    </div>
  );
}
