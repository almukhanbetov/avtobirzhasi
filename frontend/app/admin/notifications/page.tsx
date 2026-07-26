import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Уведомления — Админка",
  robots: { index: false, follow: false },
};

export default function AdminNotificationsPage() {
  return <AdminComingSoon title="Уведомления" />;
}
