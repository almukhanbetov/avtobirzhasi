import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  {
    label: string;
    error?: string;
  } & SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ label, error, className, children, ...props }, ref) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <select
          ref={ref}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-12 w-full appearance-none rounded-xl border border-border bg-surface px-4 pr-10 text-[15px] text-foreground transition-colors hover:border-foreground/30 focus:border-brand",
            error && "border-destructive focus:border-destructive",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={18}
        />
      </span>
      {error ? <span className="text-[13px] text-destructive">{error}</span> : null}
    </label>
  );
});
