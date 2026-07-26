import type { Metadata } from "next";
import { MatchesContent } from "@/components/dashboard/MatchesContent";

export const metadata: Metadata = {
  title: "Matches — AVTOBIRZHASI.KZ",
};

export default function DashboardMatchesPage() {
  return <MatchesContent />;
}
