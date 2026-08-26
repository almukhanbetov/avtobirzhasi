import type { Metadata } from "next";
import { AdminUsersContent } from "@/components/admin/AdminUsersContent";

export const metadata: Metadata = {
  title: "Пользователи — Админка",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminUsersContent />;
}
