import type { Metadata } from "next";
import { AdminEditListingContent } from "@/components/admin/AdminEditListingContent";

export const metadata: Metadata = {
  title: "Редактировать объявление — Админка",
  robots: { index: false, follow: false },
};

export default async function AdminEditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminEditListingContent listingId={id} />;
}
