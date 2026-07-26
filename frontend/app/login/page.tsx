import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/layout/Logo";
import { AuthCard } from "@/features/auth/AuthCard";

export const metadata: Metadata = {
  title: "Вход и регистрация — AVTOBIRZHASI.KZ",
};

export default function LoginPage() {
  return (
    <div className="bg-surface py-16 sm:py-24">
      <Container className="flex justify-center">
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <Logo />
          <AuthCard />
        </div>
      </Container>
    </div>
  );
}
