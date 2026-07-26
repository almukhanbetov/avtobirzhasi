import { CheckCircle2, Lock, Unlock } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

const checklist = [
  "Депозит от продавца подтверждён",
  "Депозит от покупателя подтверждён",
  "Номера телефонов открыты обеим сторонам",
];

export function TrustSection() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <SectionHeader
            eyebrow="Безопасность сделки"
            title="Контакты открываются только двум подтверждённым сторонам"
            description="Депозит 1% — это не оплата автомобиля, а подтверждение серьёзности намерений. Пока не внесены оба депозита, объявления заморожены, а номера телефонов скрыты."
          />
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Это защищает продавцов от случайных звонков и защищает покупателей
            от продавцов, которые передумали в последний момент.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Lock size={20} />
            </span>
            <span className="text-[15px] font-medium text-muted-foreground">
              Match создан, объявления заморожены
            </span>
          </div>

          <ul className="flex flex-col gap-3 border-y border-border py-5">
            {checklist.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-[15px] text-foreground"
              >
                <CheckCircle2 size={18} className="shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-light text-success">
              <Unlock size={20} />
            </span>
            <span className="text-[15px] font-medium text-foreground">
              Контакты открыты — можно договариваться о сделке
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
