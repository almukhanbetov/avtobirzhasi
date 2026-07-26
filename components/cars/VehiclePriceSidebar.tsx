import { Lock, ShieldCheck } from "lucide-react";
import type { Car } from "@/types/car";
import type { Seller } from "@/lib/mock/sellers";
import { formatTenge } from "@/lib/format/money";
import { Button } from "@/components/ui/Button";
import { MatchIndicator } from "@/components/exchange/MatchIndicator";
import { PriceMovement } from "@/components/exchange/PriceMovement";
import { PhoneReveal } from "@/components/cars/PhoneReveal";

export function VehiclePriceSidebar({
  car,
  seller,
}: {
  car: Car;
  seller: Seller;
}) {
  if (car.isExchange && car.exchangeRole && car.dailyChangePercent) {
    const isSeller = car.exchangeRole === "seller";

    return (
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">
            {isSeller ? "Текущая цена продавца" : "Текущее предложение покупателя"}
          </span>
          <MatchIndicator />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[32px] font-semibold tracking-tight text-foreground">
            {formatTenge(car.price)}
          </span>
          <PriceMovement role={car.exchangeRole} percent={car.dailyChangePercent} />
        </div>

        <p className="border-t border-border pt-4 text-[14px] leading-relaxed text-muted-foreground">
          {isSeller
            ? "Цена продавца снижается на 1% в сутки, пока не встретится с ценой покупателя."
            : "Цена покупателя растёт на 1% в сутки, пока не встретится с ценой продавца."}{" "}
          При схождении цен примерно до 2% система создаёт Match.
        </p>

        <div className="flex items-start gap-2.5 rounded-xl bg-brand-light p-4 text-[13px] leading-relaxed text-brand-dark">
          <Lock size={16} className="mt-0.5 shrink-0" />
          Контакты открываются только после того, как обе стороны внесут
          депозит 1% — это подтверждает серьёзность намерений.
        </div>

        <Button href="/exchange" variant="secondary">
          Подробнее об Автобирже
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-muted-foreground">Цена</span>
        <span className="text-[32px] font-semibold tracking-tight text-foreground">
          {formatTenge(car.price)}
        </span>
      </div>

      <PhoneReveal phone={seller.phone} />

      <div className="flex items-center gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
        <ShieldCheck size={16} className="shrink-0 text-success" />
        Прямая сделка с продавцом, без посредников
      </div>

      <div className="text-[13px] text-muted-foreground">
        {seller.name} ·{" "}
        {seller.type === "dealer" ? "Автосалон" : "Частное лицо"}
      </div>
    </div>
  );
}
