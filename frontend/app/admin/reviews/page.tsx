import type { Metadata } from "next";
import { AdminComingSoon } from "@/components/admin/AdminComingSoon";

export const metadata: Metadata = {
  title: "Отзывы — Админка",
  robots: { index: false, follow: false },
};

export default function AdminReviewsPage() {
  return <AdminComingSoon titleKey="admin.reviews.title" />;
}
