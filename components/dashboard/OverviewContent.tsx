"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  FileText,
  Gauge,
  Heart,
  LayoutGrid,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SummaryCard } from "@/components/dashboard/SummaryCard";
import { TaskItem } from "@/components/dashboard/TaskItem";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getDashboardOverview, type DashboardTask } from "@/lib/api/dashboard";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

// Short, per-type chrome — the actual copy comes from the backend's
// task.message, so these titles are deliberately distinct wording (not a
// repeat of the message) to avoid reading the same phrase twice.
const taskConfig: Record<
  DashboardTask["type"],
  { icon: LucideIcon; title: string; href: string; cta: string; tone?: "warning" }
> = {
  deposit_required: {
    icon: Wallet,
    title: "Депозит",
    href: "/dashboard/deposits",
    cta: "Внести депозит",
    tone: "warning",
  },
  moderation: {
    icon: LayoutGrid,
    title: "Модерация",
    href: "/dashboard/listings",
    cta: "Посмотреть",
  },
  notification: {
    icon: Bell,
    title: "Новое уведомление",
    href: "/dashboard/notifications",
    cta: "Открыть",
  },
};

function taskDescription(task: DashboardTask): string {
  if (task.type === "deposit_required" && task.deadline) {
    return `${task.message} — дедлайн ${dateFormatter.format(new Date(task.deadline))}`;
  }
  return task.message;
}

export function OverviewContent() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => getDashboardOverview(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Обзор
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Главное о ваших объявлениях, заявках и сделках на Автобирже.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[76px] rounded-2xl" />
          <Skeleton className="h-[76px] rounded-2xl" />
          <Skeleton className="h-[76px] rounded-2xl" />
          <Skeleton className="h-[76px] rounded-2xl" />
        </div>
      ) : isError || !data ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-[15px] text-muted-foreground">
          Не удалось загрузить обзор. Попробуйте обновить страницу через
          минуту.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={LayoutGrid}
              label="Активные объявления"
              value={data.activeListings}
            />
            <SummaryCard
              icon={FileText}
              label="Заявки на покупку"
              value={data.buyerRequests}
            />
            <SummaryCard
              icon={Gauge}
              label="Активные Match"
              value={data.activeMatches}
            />
            <SummaryCard icon={Heart} label="Избранное" value={data.favorites} />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
              Требуют внимания
            </h2>

            <div className="flex flex-col gap-3">
              {data.tasks.length > 0 ? (
                data.tasks.map((task) => {
                  const config = taskConfig[task.type];
                  return (
                    <TaskItem
                      key={task.type}
                      icon={config.icon}
                      tone={config.tone}
                      title={config.title}
                      description={taskDescription(task)}
                      href={config.href}
                      cta={config.cta}
                    />
                  );
                })
              ) : (
                <p className="rounded-2xl border border-border bg-surface p-5 text-[15px] text-muted-foreground">
                  Активных задач нет — мы сообщим, когда что-то потребует
                  вашего внимания.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
