import type { Metadata } from "next";
import { AdminModerationContent } from "@/components/admin/AdminModerationContent";

export const metadata: Metadata = {
  title: "Модерация — AVTOBIRZHASI.KZ",
  robots: { index: false, follow: false },
};

export default function AdminModerationPage() {
  return <AdminModerationContent />;
}
