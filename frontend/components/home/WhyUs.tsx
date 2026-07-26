import { Eye, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

const benefits = [
  {
    icon: Sparkles,
    title: "Автоматический подбор",
    description:
      "Не нужно вручную искать совпадения — Автобиржа сама сводит цены и участников.",
  },
  {
    icon: ShieldCheck,
    title: "Реальные намерения",
    description:
      "Депозит с обеих сторон подтверждает, что сделка серьёзная, а не праздный интерес.",
  },
  {
    icon: Eye,
    title: "Прозрачное движение цены",
    description:
      "Вы всегда видите, как меняется цена и на сколько она приблизилась к сделке.",
  },
  {
    icon: Gauge,
    title: "Контролируемый процесс",
    description:
      "Контакты открываются только после подтверждения обеих сторон — без спама и случайных звонков.",
  },
];

export function WhyUs() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          align="center"
          eyebrow="Почему AVTOBIRZHASI"
          title="Преимущества платформы"
        />

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex flex-col items-center gap-4 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand">
                <benefit.icon size={22} strokeWidth={2} />
              </span>
              <h3 className="text-[17px] font-semibold tracking-tight text-foreground">
                {benefit.title}
              </h3>
              <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
