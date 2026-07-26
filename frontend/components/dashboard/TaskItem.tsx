import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function TaskItem({
  icon: Icon,
  title,
  description,
  href,
  cta,
  tone = "brand",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone?: "brand" | "warning";
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tone === "warning"
              ? "bg-warning-light text-warning"
              : "bg-brand-light text-brand",
          )}
        >
          <Icon size={18} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-foreground">
            {title}
          </span>
          <span className="text-[14px] text-muted-foreground">
            {description}
          </span>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1.5 text-[14px] font-semibold text-brand hover:text-brand-dark"
      >
        {cta}
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}
