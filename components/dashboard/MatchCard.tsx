import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTenge } from "@/lib/format/money";
import { matchStatusLabels } from "@/lib/labels/dashboard";
import type { MatchDeal, MatchStatus } from "@/types/dashboard";

const statusVariant: Record<
  MatchStatus,
  "brand" | "success" | "warning" | "neutral"
> = {
  awaiting_deposit: "warning",
  seller_deposit_paid: "brand",
  buyer_deposit_paid: "brand",
  confirmed: "success",
  expired: "neutral",
  cancelled: "neutral",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function MatchCard({ match }: { match: MatchDeal }) {
  const needsMyDeposit =
    (match.role === "seller" && !match.sellerDepositPaid) ||
    (match.role === "buyer" && !match.buyerDepositPaid);
  const isOpen = match.status !== "expired" && match.status !== "cancelled";

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-background sm:h-24 sm:w-36">
        <Image
          src={match.car.imageUrl}
          alt={`${match.car.make} ${match.car.model}`}
          fill
          sizes="200px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[16px] font-semibold text-foreground">
            {match.car.make} {match.car.model} {match.car.year}
          </span>
          <Badge variant={statusVariant[match.status]}>
            {matchStatusLabels[match.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex flex-col">
            <span className="text-[12px] text-muted-foreground">
              Финальная цена
            </span>
            <span className="text-[15px] font-semibold text-foreground">
              {formatTenge(match.finalPrice)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] text-muted-foreground">
              Ваш депозит
            </span>
            <span className="text-[15px] font-semibold text-foreground">
              {formatTenge(match.depositAmount)}
            </span>
          </div>
          {isOpen ? (
            <div className="flex flex-col">
              <span className="text-[12px] text-muted-foreground">
                Дедлайн
              </span>
              <span className="text-[15px] font-semibold text-foreground">
                {dateFormatter.format(new Date(match.deadline))}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <span className={match.sellerDepositPaid ? "text-success" : ""}>
            Депозит продавца:{" "}
            {match.sellerDepositPaid ? "внесён" : "ожидается"}
          </span>
          <span aria-hidden>·</span>
          <span className={match.buyerDepositPaid ? "text-success" : ""}>
            Депозит покупателя:{" "}
            {match.buyerDepositPaid ? "внесён" : "ожидается"}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 sm:flex-col sm:items-end">
        {needsMyDeposit ? (
          <Button href="/dashboard/deposits">Внести депозит</Button>
        ) : match.status === "confirmed" ? (
          <Link
            href={`/cars/${match.car.id}`}
            className="text-[14px] font-semibold text-brand hover:text-brand-dark"
          >
            Контакты открыты →
          </Link>
        ) : (
          <Link
            href="/cars"
            className="text-[14px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Смотреть похожие
          </Link>
        )}
      </div>
    </div>
  );
}
