import { Banknote, ChevronRight, GitMerge, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const stages = [
  { icon: GitMerge, label: "Match создан" },
  { icon: Banknote, label: "Депозит продавца внесён" },
  { icon: Banknote, label: "Депозит покупателя внесён" },
  { icon: Unlock, label: "Контакты открыты" },
];

export function MatchLifecycle() {
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
          <Badge variant="warning">Истёк срок</Badge>
          Если депозиты не внесены вовремя, объявления снова становятся
          активными.
        </div>
        <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
          <Badge variant="neutral">Отменено</Badge>
          Если одна из сторон отменяет сделку, внесённый депозит
          возвращается.
        </div>
      </div>
    </div>
  );
}
