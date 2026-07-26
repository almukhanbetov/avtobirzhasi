import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  title,
  description,
  resetHref,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  resetHref?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface px-6 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light text-brand">
        <SearchX size={26} strokeWidth={2} />
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          {description}
        </p>
      </div>
      {resetHref || secondaryHref ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          {resetHref ? (
            <Button href={resetHref} variant="secondary">
              Сбросить фильтры
            </Button>
          ) : null}
          {secondaryHref ? (
            <Button href={secondaryHref}>{secondaryLabel}</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
