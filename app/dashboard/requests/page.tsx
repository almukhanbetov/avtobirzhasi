import type { Metadata } from "next";
import { RequestsContent } from "@/components/dashboard/RequestsContent";

export const metadata: Metadata = {
  title: "Заявки на покупку — AVTOBIRZHASI.KZ",
};

export default function DashboardRequestsPage() {
  return <RequestsContent />;
}
