import { Lock, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MatchLifecycle } from "@/components/exchange/MatchLifecycle";

export function DepositsSafety() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow="Депозит и безопасность"
          title="Контакты открываются только двум подтверждённым сторонам"
          description="Депозит 1% — это не оплата автомобиля, а подтверждение серьёзности намерений. Пока не внесены оба депозита, объявления заморожены, а контакты скрыты."
        />

        <MatchLifecycle />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
              <Lock size={20} />
            </span>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              До внесения обоих депозитов номера телефонов скрыты — это
              защищает продавца от случайных звонков, а покупателя — от
              продавцов, которые передумали в последний момент.
            </p>
          </div>
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-background p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-light text-success">
              <ShieldCheck size={20} />
            </span>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Депозит — это подтверждение намерений, а не оплата автомобиля.
              Если сделка не состоится по вине другой стороны, депозит
              возвращается в полном размере.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
