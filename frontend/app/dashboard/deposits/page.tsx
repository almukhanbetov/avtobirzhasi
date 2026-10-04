import type { Metadata } from "next";
import { DepositsContent } from "@/components/dashboard/DepositsContent";

export const metadata: Metadata = {
  title: "Комиссии — AVTOBIRZHASI.KZ",
};

export default function DashboardDepositsPage() {
  return <DepositsContent />;
}
