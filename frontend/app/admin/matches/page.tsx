import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Matches — Админка",
  robots: { index: false, follow: false },
};

export default function AdminMatchesPage() {
  return <AdminComingSoon titleKey="dashboard.nav.matches" />;
}
