import { cn } from "@/lib/utils";

type Variant = "brand" | "neutral" | "success" | "warning" | "outline";

const variantClasses: Record<Variant, string> = {
  brand: "bg-brand text-white",
  neutral: "bg-black/[0.05] text-foreground",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  outline: "border border-border bg-surface text-muted-foreground",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium leading-none",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
