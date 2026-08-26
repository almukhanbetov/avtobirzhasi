import type { Metadata } from "next";
import { Suspense } from "react";
import { DepositReturnContent } from "@/components/dashboard/DepositReturnContent";

export const metadata: Metadata = {
  title: "Оплата депозита — AVTOBIRZHASI.KZ",
};

export default function DashboardDepositReturnPage() {
  return (
    <Suspense fallback={null}>
      <DepositReturnContent />
    </Suspense>
  );
}
