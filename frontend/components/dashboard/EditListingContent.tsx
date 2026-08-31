"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { ListingForm } from "@/features/listings/ListingForm";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyListings } from "@/lib/api/listings";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// The edit page reuses the dashboard-listings query (the same data
// ListingRow renders) and the one ListingForm, in edit mode. A listing
// that isn't in the caller's own list — someone else's, or a bad id —
// simply isn't shown; the backend enforces ownership on save regardless.
export function EditListingContent({ listingId }: { listingId: string }) {
  const { token } = useAuth();
  const { t } = useLanguage();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "listings"],
    queryFn: () => listMyListings(token as string),
    enabled: Boolean(token),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  const listing = data?.find((l) => l.id === listingId);

  if (isError || !listing) {
    return (
      <EmptyState
        title={t("dashboard.listings.emptyTitle")}
        description={t("dashboard.listings.emptyDescription")}
        secondaryHref="/dashboard/listings"
        secondaryLabel={t("dashboard.nav.listings")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/listings"
        className="text-[14px] font-medium text-brand hover:text-brand-dark"
      >
        ← {t("dashboard.nav.listings")}
      </Link>
      <ListingForm mode="edit" listing={listing} />
    </div>
  );
}
