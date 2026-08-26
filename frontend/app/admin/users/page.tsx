import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Пользователи — Админка",
  robots: { index: false, follow: false },
};

export default function AdminUsersPage() {
  return <AdminComingSoon titleKey="admin.users.title" />;
}
