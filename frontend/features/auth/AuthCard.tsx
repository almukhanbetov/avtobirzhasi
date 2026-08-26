"use client";

import { useState } from "react";
import { LoginForm } from "@/features/auth/LoginForm";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function AuthCard() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-surface p-8">
      <div className="flex rounded-xl bg-background p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-[14px] font-semibold transition-colors",
            mode === "login"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {t("header.login")}
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={cn(
            "flex-1 rounded-lg py-2.5 text-[14px] font-semibold transition-colors",
            mode === "register"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {t("auth.registerTab")}
        </button>
      </div>

      {mode === "login" ? <LoginForm /> : <RegisterForm />}

      <p className="text-center text-[13px] text-muted-foreground">
        {t("auth.terms")}
      </p>
    </div>
  );
}
