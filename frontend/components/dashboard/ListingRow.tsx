"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { archiveListing } from "@/lib/api/listings";
import type { SellerListing } from "@/types/dashboard";

export function ListingRow({ listing }: { listing: SellerListing }) {
  const { lang, t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const status = listingStatusLabels[lang][listing.status];
  const [menuOpen, setMenuOpen] = useState(false);

  // A listing that's frozen into a match, or already archived, isn't the
  // owner's to change any more (matches the previous per-action guard).
  const canManage = listing.status === "active" || listing.status === "moderation";

  const deleteMutation = useMutation({
    mutationFn: () => archiveListing(token as string, listing.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dashboard", "listings"] }),
  });

  function handleDelete() {
    setMenuOpen(false);
    if (window.confirm(t("row.deleteConfirm"))) {
      deleteMutation.mutate();
    }
  }

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
          {t("row.updated")} {formatShortDate(listing.updatedAt, lang)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(listing.car.price)}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={`/cars/${listing.car.id}`}
            className="text-[14px] font-semibold text-brand hover:text-brand-dark"
          >
            {t("row.open")}
          </Link>

          <div className="relative">
            <button
              type="button"
              aria-label={t("row.actions")}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={!canManage || deleteMutation.isPending}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label={t("header.closeMenu")}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 flex w-44 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
                >
                  <Link
                    role="menuitem"
                    href={`/dashboard/listings/${listing.id}/edit`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-3 text-[14px] font-medium text-foreground hover:bg-black/[0.04]"
                  >
                    <Pencil size={15} />
                    {t("row.editListing")}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDelete}
                    className="flex items-center gap-2.5 border-t border-border px-4 py-3 text-left text-[14px] font-medium text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={15} />
                    {t("row.delete")}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
