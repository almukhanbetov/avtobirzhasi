import type { Metadata } from "next";
import { ListingsContent } from "@/components/dashboard/ListingsContent";

export const metadata: Metadata = {
  title: "Мои объявления — AVTOBIRZHASI.KZ",
};

export default function DashboardListingsPage() {
  return <ListingsContent />;
}
