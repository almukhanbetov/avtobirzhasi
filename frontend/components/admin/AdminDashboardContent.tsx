"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, GitMerge, LayoutGrid, Users, Wallet } from "lucide-react";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminStats } from "@/lib/api/admin";

function StatBreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
          >
            <span className="text-[14px] text-muted-foreground">{row.label}</span>
            <span className="text-[14px] font-semibold text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardContent() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Dashboard
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Общая статистика по AVTOBIRZHASI.KZ.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-[15px] text-muted-foreground">
          Не удалось загрузить статистику. Попробуйте обновить страницу через
          минуту.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard icon={Users} label="Пользователи" value={data.users} />
            <SummaryCard
              icon={LayoutGrid}
              label="Объявления"
              value={data.listings.total}
            />
            <SummaryCard
              icon={FileText}
              label="Заявки на покупку"
              value={data.buyerRequests.total}
            />
            <SummaryCard icon={GitMerge} label="Matches" value={data.matches.total} />
            <SummaryCard icon={Wallet} label="Депозиты" value={data.deposits.total} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatBreakdownCard
              title="Объявления"
              rows={[
                { label: "Активные", value: data.listings.active },
                { label: "На модерации", value: data.listings.moderation },
                { label: "Заморожены (в сделке)", value: data.listings.frozen },
                { label: "В архиве", value: data.listings.archived },
                { label: "Участвуют в Автобирже", value: data.listings.exchange },
              ]}
            />
            <StatBreakdownCard
              title="Matches"
              rows={[
                { label: "Ожидают депозит", value: data.matches.awaitingDeposit },
                { label: "Один депозит внесён", value: data.matches.partiallyPaid },
                { label: "Подтверждены", value: data.matches.confirmed },
                { label: "Истёк срок", value: data.matches.expired },
                { label: "Отменены", value: data.matches.cancelled },
              ]}
            />
            <StatBreakdownCard
              title="Депозиты"
              rows={[
                { label: "Ожидают оплаты", value: data.deposits.pending },
                { label: "Оплачены", value: data.deposits.paid },
                { label: "Возвращены", value: data.deposits.refunded },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
