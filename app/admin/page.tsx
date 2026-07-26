import type { Metadata } from "next";
import { AdminDashboardContent } from "@/components/admin/AdminDashboardContent";

export const metadata: Metadata = {
  title: "Dashboard — Админка",
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}
