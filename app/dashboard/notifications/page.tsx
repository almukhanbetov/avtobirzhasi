import type { Metadata } from "next";
import { NotificationsContent } from "@/components/dashboard/NotificationsContent";

export const metadata: Metadata = {
  title: "Уведомления — AVTOBIRZHASI.KZ",
};

export default function DashboardNotificationsPage() {
  return <NotificationsContent />;
}
