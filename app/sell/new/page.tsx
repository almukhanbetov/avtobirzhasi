import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ListingForm } from "@/features/listings/ListingForm";

export const metadata: Metadata = {
  title: "Продать автомобиль — AVTOBIRZHASI.KZ",
};

export default function SellNewPage() {
  return (
    <div className="bg-surface py-12 sm:py-16">
      <Container className="flex justify-center">
        <div className="flex w-full max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
              Продать автомобиль
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Заполните данные об автомобиле — объявление появится после
              модерации.
            </p>
          </div>
          <RequireAuth>
            <ListingForm />
          </RequireAuth>
        </div>
      </Container>
    </div>
  );
}
