"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { depositStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Deposit } from "@/types/dashboard";

export function DepositRow({
  deposit,
  onPay,
  isPaying,
}: {
  deposit: Deposit;
  onPay?: () => void;
  isPaying?: boolean;
}) {
  const { lang, t } = useLanguage();
  const status = depositStatusLabels[lang][deposit.status];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-background sm:h-16 sm:w-24">
        <Image
          src={deposit.car.imageUrl}
          alt={`${deposit.car.make} ${deposit.car.model}`}
          fill
          sizes="150px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            {deposit.car.make} {deposit.car.model}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {formatShortDate(deposit.date, lang)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(deposit.amount)}
        </span>
        {deposit.status === "pending" ? (
          <Button size="md" onClick={onPay} disabled={isPaying}>
            {isPaying ? t("row.paying") : t("row.pay")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
