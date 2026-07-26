import {
  Banknote,
  GitMerge,
  PencilLine,
  TrendingUpDown,
  Unlock,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

const steps = [
  {
    icon: PencilLine,
    title: "Укажите цену",
    description:
      "Продавец назначает цену автомобиля, покупатель — сумму, которую готов заплатить.",
  },
  {
    icon: TrendingUpDown,
    title: "Цены сближаются",
    description:
      "Цена продавца снижается на 1% в сутки, предложение покупателя растёт на 1% в сутки.",
  },
  {
    icon: GitMerge,
    title: "Match",
    description:
      "Когда разница доходит примерно до 2%, Автобиржа фиксирует совпадение и замораживает оба объявления.",
  },
  {
    icon: Banknote,
    title: "Депозит 1%",
    description:
      "Продавец и покупатель вносят депозит в размере 1% от цены — это подтверждает серьёзность намерений.",
  },
  {
    icon: Unlock,
    title: "Контакты открыты",
    description:
      "После двух депозитов стороны получают контакты друг друга и договариваются о сделке.",
  },
];

export function ExchangeSteps() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow="Как это работает"
          title="Пять шагов от объявления до сделки"
          description="Автобиржа сама сводит покупателя и продавца — без ручного поиска и случайных звонков."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-6"
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
