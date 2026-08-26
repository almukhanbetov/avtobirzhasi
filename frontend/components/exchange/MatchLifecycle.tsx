"use client";

import { Banknote, ChevronRight, GitMerge, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { matchStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function MatchLifecycle() {
  const { lang, t } = useLanguage();

  const stages = [
    { icon: GitMerge, label: t("exchange.lifecycle.stage1") },
    { icon: Banknote, label: t("exchange.lifecycle.stage2") },
    { icon: Banknote, label: t("exchange.lifecycle.stage3") },
    { icon: Unlock, label: t("exchange.lifecycle.stage4") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-2">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-brand-light p-4 text-center sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
                <stage.icon size={18} />
              </span>
              <span className="text-[13px] font-medium text-foreground">
                {stage.label}
              </span>
            </div>
            {index < stages.length - 1 ? (
              <ChevronRight
                size={18}
                className="hidden shrink-0 text-muted-foreground sm:block"
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
          <Badge variant="warning">{matchStatusLabels[lang].expired}</Badge>
          {t("exchange.lifecycle.expiredNote")}
        </div>
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
          <Badge variant="neutral">{matchStatusLabels[lang].cancelled}</Badge>
          {t("exchange.lifecycle.cancelledNote")}
        </div>
      </div>
    </div>
  );
}
