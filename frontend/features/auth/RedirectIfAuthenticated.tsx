"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { postAuthPath } from "@/lib/auth/postAuthPath";

// Rendered on /login: if the visitor already has a live session, send
// them where a fresh login would (admin -> /admin, everyone else ->
// /dashboard) instead of showing them the auth form again. Renders
// nothing itself. Waits for "authenticated" specifically, so a token
// still being validated on mount doesn't cause a premature bounce.
export function RedirectIfAuthenticated() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(postAuthPath(user));
    }
  }, [status, user, router]);

  return null;
}
