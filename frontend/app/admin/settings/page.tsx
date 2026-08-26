import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Настройки — Админка",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return <AdminComingSoon titleKey="admin.settings.title" />;
}
