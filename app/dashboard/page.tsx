import type { Metadata } from "next";
import { OverviewContent } from "@/components/dashboard/OverviewContent";

export const metadata: Metadata = {
  title: "Личный кабинет — AVTOBIRZHASI.KZ",
};

export default function DashboardOverviewPage() {
  return <OverviewContent />;
}
