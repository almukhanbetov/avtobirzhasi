import { ArrowRight, GitMerge, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

const ways = [
  {
    icon: ShoppingBag,
    title: "Купить сейчас",
    description:
      "Выбирайте из готовых объявлений и связывайтесь с продавцом напрямую по опубликованной цене.",
    points: [
      "Актуальные цены от собственников",
      "Прямая связь с продавцом",
      "Можно оформить сделку сегодня",
    ],
    href: "/cars",
    cta: "Смотреть автомобили",
  },
  {
    icon: GitMerge,
    title: "Купить через Автобиржу",
    description:
      "Укажите цену, которую готовы заплатить. Система сама сведёт вас с продавцом, когда цены сойдутся.",
    points: [
      "Цена продавца снижается, ваша — растёт",
      "Match создаётся автоматически",
      "Контакты открываются после депозита",
    ],
    href: "/exchange",
    cta: "Создать заявку на покупку",
  },
];

export function BuyingWays() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeader
          eyebrow="Два пути к сделке"
          title="Два способа купить автомобиль"
          description="Выбирайте привычную покупку по объявлению или доверьте подбор цены Автобирже."
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {ways.map((way) => (
            <div
              key={way.title}
              className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-8 sm:p-10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-light text-brand">
                <way.icon size={24} strokeWidth={2} />
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  {way.title}
                </h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">
                  {way.description}
                </p>
              </div>
              <ul className="flex flex-col gap-2.5">
                {way.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2.5 text-[15px] text-foreground"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={way.href}
                className="mt-2 inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
              >
                {way.cta}
                <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
