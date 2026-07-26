import type { Metadata } from "next";
import { FavoritesContent } from "@/components/dashboard/FavoritesContent";

export const metadata: Metadata = {
  title: "Избранное — AVTOBIRZHASI.KZ",
};

export default function DashboardFavoritesPage() {
  return <FavoritesContent />;
}
