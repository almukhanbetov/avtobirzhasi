import { Banknote, GitMerge, Snowflake, TrendingUpDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PriceConvergenceDiagram } from "@/components/exchange/PriceConvergenceDiagram";

const steps = [
  {
    icon: TrendingUpDown,
    title: "Цены сближаются",
    description:
      "Цена продавца снижается на 1% в сутки, цена покупателя растёт на 1% в сутки — навстречу друг другу.",
  },
  {
    icon: GitMerge,
    title: "Match и заморозка",
    description:
      "Когда разница в цене доходит примерно до 2%, система создаёт Match. Оба объявления замораживаются.",
  },
  {
    icon: Banknote,
    title: "Депозит 1%",
    description:
      "Продавец и покупатель вносят депозит в размере 1% от цены сделки — это подтверждает серьёзность намерений.",
  },
  {
    icon: Snowflake,
    title: "Контакты открыты",
    description:
      "После того как оба депозита внесены, стороны получают контакты друг друга и договариваются о сделке.",
  },
];

export function ExchangeExplainer() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow="Автобиржа"
          title="Как работает Автобиржа"
          description="Автоматический механизм, который сводит покупателя и продавца, когда их цены встречаются."
        />

        <PriceConvergenceDiagram />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
                  <step.icon size={20} strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
