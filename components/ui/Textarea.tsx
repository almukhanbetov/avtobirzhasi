import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  {
    label: string;
    error?: string;
  } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ label, error, className, rows = 4, ...props }, ref) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn(
          "w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus:border-brand",
          error && "border-destructive focus:border-destructive",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-[13px] text-destructive">{error}</span> : null}
    </label>
  );
});
