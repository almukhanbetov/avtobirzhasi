"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListingForm } from "@/features/listings/ListingForm";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getAdminListing } from "@/lib/api/admin";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// Admin edit: fetches one listing (any owner, any status) via
// GET /api/admin/listings/:id and hands it to the one shared ListingForm
// in edit mode with admin — so the whole form, the photo drag-and-drop
// (ImageUploadField) and validation are identical to the owner's edit
// page; only the submit target (updateAdminListing) differs.
export function AdminEditListingContent({ listingId }: { listingId: string }) {
  const { token } = useAuth();
  const { t } = useLanguage();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "listing", listingId],
    queryFn: () => getAdminListing(token as string, listingId),
    enabled: Boolean(token),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title={t("admin.listings.loadErrorTitle")}
        description={t("admin.listings.emptyDescription")}
        secondaryHref="/admin/listings"
        secondaryLabel={t("admin.listings.title")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/listings"
        className="text-[14px] font-medium text-brand hover:text-brand-dark"
      >
        ← {t("admin.listings.title")}
      </Link>
      <p className="text-[13px] text-muted-foreground">
        {data.car.make} {data.car.model} · {data.sellerName}
      </p>
      <ListingForm mode="edit" listing={data} admin />
    </div>
  );
}
