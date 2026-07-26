import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequestForm } from "@/features/requests/RequestForm";

export const metadata: Metadata = {
  title: "Заявка на покупку — AVTOBIRZHASI.KZ",
};

export default function RequestNewPage() {
  return (
    <div className="bg-surface py-12 sm:py-16">
      <Container className="flex justify-center">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
              Заявка на покупку
            </h1>
            <p className="text-[15px] text-muted-foreground">
              Укажите, какой автомобиль вы ищете — Автобиржа сама найдёт
              подходящее объявление.
            </p>
          </div>
          <RequireAuth>
            <RequestForm />
          </RequireAuth>
        </div>
      </Container>
    </div>
  );
}
