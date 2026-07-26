import type { Metadata } from "next";
import { ProfileContent } from "@/components/dashboard/ProfileContent";

export const metadata: Metadata = {
  title: "Профиль — AVTOBIRZHASI.KZ",
};

export default function DashboardProfilePage() {
  return <ProfileContent />;
}
