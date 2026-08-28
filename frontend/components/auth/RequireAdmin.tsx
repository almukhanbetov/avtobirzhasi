"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// RequireAdmin is the admin-panel counterpart to RequireAuth: a UX gate,
// not the security boundary (every admin API call re-checks
// users.role='admin' itself — see middleware.AdminOnly and
// STAGE1_ADMIN_AUTHORIZATION_REPORT.md).
//
// Behaviour, by session state:
//   - loading                    -> spinner (token is being validated)
//   - unauthenticated            -> redirect to /login
//   - authenticated, role!=admin -> explicit "access denied" panel
//   - authenticated, role=admin  -> render the admin panel
//
// It must NEVER send anyone to the public homepage: landing on "/" from
// /admin reads as "the admin route doesn't exist" — the exact bug
// STAGE13_ADMIN_ROUTE_REPORT.md fixed (a signed-in non-admin was
// router.replace("/")'d straight onto the marketing homepage).
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const isAdmin = status === "authenticated" && user?.role === "admin";
  const isDenied =
    status === "authenticated" && !!user && user.role !== "admin";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (isAdmin) {
    return <>{children}</>;
  }

  if (isDenied) {
    return (
      <div className="flex min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-[20px] font-semibold text-foreground">
          {t("admin.denied.title")}
        </h1>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          {t("admin.denied.body")}
        </p>
        <Link
          href="/"
          className="text-[15px] font-medium text-brand hover:underline"
        >
          {t("admin.denied.home")}
        </Link>
      </div>
    );
  }

  // loading, or unauthenticated with the /login redirect already in flight
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center text-[15px] text-muted-foreground">
      {t("auth.loading")}
    </div>
  );
}
