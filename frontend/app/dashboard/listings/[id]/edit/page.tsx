import type { Metadata } from "next";
import { EditListingContent } from "@/components/dashboard/EditListingContent";

export const metadata: Metadata = {
  title: "Редактировать объявление — AVTOBIRZHASI.KZ",
};

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditListingContent listingId={id} />;
}
