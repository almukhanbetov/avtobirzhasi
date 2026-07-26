import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ExchangeHero } from "@/components/exchange/ExchangeHero";
import { ExchangeSimulator } from "@/components/exchange/ExchangeSimulator";
import { ExchangeSteps } from "@/components/exchange/ExchangeSteps";
import { ExchangeExample } from "@/components/exchange/ExchangeExample";
import { DepositsSafety } from "@/components/exchange/DepositsSafety";
import { FinalCta } from "@/components/home/FinalCta";

export const metadata: Metadata = {
  title: "Автобиржа — как работает автоматический подбор | AVTOBIRZHASI.KZ",
  description:
    "Цена продавца снижается на 1% в сутки, цена покупателя растёт на 1% в сутки. Когда цены сходятся примерно до 2%, Автобиржа создаёт Match.",
};

export default function ExchangePage() {
  return (
    <>
      <ExchangeHero />

      <section className="py-20 sm:py-28">
        <Container className="flex flex-col gap-12">
          <SectionHeader
            align="center"
            eyebrow="Визуализация"
            title="Как сближаются цены"
            description="Передвиньте ползунок или запустите воспроизведение — посмотрите, как цена продавца и предложение покупателя сходятся день за днём."
          />
          <ExchangeSimulator />
        </Container>
      </section>

      <ExchangeSteps />
      <ExchangeExample />
      <DepositsSafety />
      <FinalCta />
    </>
  );
}
