"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// RequireAuth is a UX convenience, not a security boundary — every
// backend endpoint behind it re-checks the JWT itself. This just avoids
// flashing protected content (or an empty form) before redirecting a
// logged-out visitor to /login. See nextjs-frontend-architecture skill:
// "Do not trust route guards only in UI." Used by the dashboard layout and
// by any other authenticated-only page (e.g. /sell/new, /exchange/new).
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center text-[15px] text-muted-foreground">
        {t("auth.loading")}
      </div>
    );
  }

  return <>{children}</>;
}
