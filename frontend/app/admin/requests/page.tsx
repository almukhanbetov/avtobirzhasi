import type { Metadata } from "next";
import { AdminRequestsContent } from "@/components/admin/AdminRequestsContent";

export const metadata: Metadata = {
  title: "Заявки на покупку — Админка",
  robots: { index: false, follow: false },
};

export default function AdminRequestsPage() {
  return <AdminRequestsContent />;
}
