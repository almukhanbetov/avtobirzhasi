import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ListingForm } from "@/features/listings/ListingForm";
import { SellNewHeader } from "@/features/listings/SellNewHeader";

export const metadata: Metadata = {
  title: "Продать автомобиль — AVTOBIRZHASI.KZ",
};

export default function SellNewPage() {
  return (
    <div className="bg-surface py-12 sm:py-16">
      <Container className="flex justify-center">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <SellNewHeader />
          <RequireAuth>
            <ListingForm />
          </RequireAuth>
        </div>
      </Container>
    </div>
  );
}
