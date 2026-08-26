import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequestForm } from "@/features/requests/RequestForm";
import { RequestNewHeader } from "@/features/requests/RequestNewHeader";

export const metadata: Metadata = {
  title: "Заявка на покупку — AVTOBIRZHASI.KZ",
};

export default function RequestNewPage() {
  return (
    <div className="bg-surface py-12 sm:py-16">
      <Container className="flex justify-center">
        <div className="flex w-full max-w-md flex-col gap-8">
          <RequestNewHeader />
          <RequireAuth>
            <RequestForm />
          </RequireAuth>
        </div>
      </Container>
    </div>
  );
}
