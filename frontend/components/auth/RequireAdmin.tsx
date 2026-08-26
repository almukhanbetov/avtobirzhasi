"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// RequireAdmin is the admin-panel counterpart to RequireAuth: it's still a
// UX convenience, not the real security boundary (every /internal/*
// endpoint behind it re-checks users.role='admin' itself — see
// middleware.AdminOnly and STAGE1_ADMIN_AUTHORIZATION_REPORT.md). It just
// keeps a logged-out visitor or a non-admin account from seeing the admin
// shell render before the backend calls it makes start failing with
// 401/403.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const isAdmin = status === "authenticated" && user?.role === "admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [status, user, router]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center text-[15px] text-muted-foreground">
        {t("auth.loading")}
      </div>
    );
  }

  return <>{children}</>;
}
