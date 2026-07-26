import type { LucideIcon } from "lucide-react";

export function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
        <Icon size={20} />
      </span>
      <div className="flex flex-col">
        <span className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
