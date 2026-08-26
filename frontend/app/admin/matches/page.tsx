import type { Metadata } from "next";
import { AdminMatchesContent } from "@/components/admin/AdminMatchesContent";

export const metadata: Metadata = {
  title: "Matches — Админка",
  robots: { index: false, follow: false },
};

export default function AdminMatchesPage() {
  return <AdminMatchesContent />;
}
