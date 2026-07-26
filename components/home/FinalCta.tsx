import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section className="bg-brand py-20 sm:py-24">
      <Container className="flex flex-col items-center gap-8 text-center">
        <h2 className="max-w-2xl text-[32px] font-semibold tracking-tight text-white sm:text-[40px]">
          Готовы продать или найти автомобиль по своей цене?
        </h2>
        <p className="max-w-xl text-lg text-white/85">
          Разместите объявление или создайте заявку на покупку — Автобиржа
          возьмёт согласование цены на себя.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            href="/sell/new"
            size="lg"
            variant="secondary"
            className="border-transparent bg-white text-brand hover:bg-white/90"
          >
            Продать автомобиль
          </Button>
          <Button
            href="/exchange/new"
            size="lg"
            variant="ghost"
            className="border border-white/40 text-white hover:bg-white/10"
          >
            Создать заявку на покупку
          </Button>
        </div>
      </Container>
    </section>
  );
}
