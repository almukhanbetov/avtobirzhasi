import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  {
    label: string;
    error?: string;
  } & InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, error, className, ...props }, ref) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <input
        ref={ref}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus:border-brand",
          error && "border-destructive focus:border-destructive",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-[13px] text-destructive">{error}</span> : null}
    </label>
  );
});
