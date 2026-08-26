import type { Metadata } from "next";
import { AdminListingsContent } from "@/components/admin/AdminListingsContent";

export const metadata: Metadata = {
  title: "Все объявления — Админка",
  robots: { index: false, follow: false },
};

export default function AdminListingsPage() {
  return <AdminListingsContent />;
}
