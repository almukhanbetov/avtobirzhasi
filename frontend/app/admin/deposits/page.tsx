import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Депозиты — Админка",
  robots: { index: false, follow: false },
};

export default function AdminDepositsPage() {
  return <AdminComingSoon titleKey="dashboard.nav.deposits" />;
}
