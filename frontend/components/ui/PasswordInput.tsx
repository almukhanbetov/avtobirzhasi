"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  {
    label: string;
    error?: string;
  } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ label, error, className, ...props }, ref) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <label className="flex w-full flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="relative block">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-12 w-full rounded-xl border border-border bg-surface px-4 pr-11 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus:border-brand",
            error && "border-destructive focus:border-destructive",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t("password.hide") : t("password.show")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {error ? (
        <span className="text-[13px] text-destructive">{error}</span>
      ) : null}
    </label>
  );
});
