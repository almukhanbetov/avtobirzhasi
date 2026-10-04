import type { Metadata } from "next";
import { AdminDepositsContent } from "@/components/admin/AdminDepositsContent";

export const metadata: Metadata = {
  title: "Комиссии — Админка",
  robots: { index: false, follow: false },
};

export default function AdminDepositsPage() {
  return <AdminDepositsContent />;
}
