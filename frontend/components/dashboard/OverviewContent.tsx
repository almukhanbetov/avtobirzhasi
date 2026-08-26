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
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatDateTime } from "@/lib/format/date";
import type { Lang, TranslationKey } from "@/lib/i18n/translations";

// Short, per-type chrome — the actual copy comes from the backend's
// task.message, so these titles are deliberately distinct wording (not a
// repeat of the message) to avoid reading the same phrase twice.
const taskConfig: Record<
  DashboardTask["type"],
  { icon: LucideIcon; titleKey: TranslationKey; href: string; ctaKey: TranslationKey; tone?: "warning" }
> = {
  deposit_required: {
    icon: Wallet,
    titleKey: "dashboard.overview.task.deposit",
    href: "/dashboard/deposits",
    ctaKey: "match.payDeposit",
    tone: "warning",
  },
  moderation: {
    icon: LayoutGrid,
    titleKey: "dashboard.overview.task.moderation",
    href: "/dashboard/listings",
    ctaKey: "dashboard.overview.task.moderationCta",
  },
  notification: {
    icon: Bell,
    titleKey: "dashboard.overview.task.newNotification",
    href: "/dashboard/notifications",
    ctaKey: "row.open",
  },
};

function taskDescription(
  task: DashboardTask,
  lang: Lang,
  t: (key: TranslationKey) => string,
): string {
  if (task.type === "deposit_required" && task.deadline) {
    return `${task.message} — ${t("dashboard.overview.deadlinePrefix")} ${formatDateTime(task.deadline, lang)}`;
  }
  return task.message;
}

export function OverviewContent() {
  const { token } = useAuth();
  const { lang, t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => getDashboardOverview(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.overview")}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("dashboard.overview.subtitle")}
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
          {t("dashboard.overview.loadError")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={LayoutGrid}
              label={t("dashboard.overview.activeListings")}
              value={data.activeListings}
            />
            <SummaryCard
              icon={FileText}
              label={t("dashboard.nav.requests")}
              value={data.buyerRequests}
            />
            <SummaryCard
              icon={Gauge}
              label={t("dashboard.overview.activeMatches")}
              value={data.activeMatches}
            />
            <SummaryCard icon={Heart} label={t("header.favorites")} value={data.favorites} />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
              {t("dashboard.overview.needsAttention")}
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
                      title={t(config.titleKey)}
                      description={taskDescription(task, lang, t)}
                      href={config.href}
                      cta={t(config.ctaKey)}
                    />
                  );
                })
              ) : (
                <p className="rounded-2xl border border-border bg-surface p-5 text-[15px] text-muted-foreground">
                  {t("dashboard.overview.noTasks")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
