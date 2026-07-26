import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export function ExchangeHero() {
  return (
    <section className="bg-surface py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-6 text-center">
        <span className="text-sm font-semibold uppercase tracking-wide text-brand">
          Автобиржа
        </span>
        <h1 className="max-w-3xl text-[42px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[54px]">
          Цены сами находят друг друга
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Продавец снижает цену на 1% в сутки, покупатель повышает предложение
          на 1% в сутки. Когда цены сближаются примерно до 2%, Автобиржа
          автоматически фиксирует сделку.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button href="/sell/new" size="lg">
            Продать автомобиль
          </Button>
          <Button href="/exchange/new" variant="secondary" size="lg">
            Подать заявку на покупку
          </Button>
        </div>
      </Container>
    </section>
  );
}
