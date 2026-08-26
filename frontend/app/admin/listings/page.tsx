import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Все объявления — Админка",
  robots: { index: false, follow: false },
};

export default function AdminListingsPage() {
  return <AdminComingSoon titleKey="admin.listings.title" />;
}
