import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Заявки на покупку — Админка",
  robots: { index: false, follow: false },
};

export default function AdminRequestsPage() {
  return <AdminComingSoon titleKey="dashboard.nav.requests" />;
}
