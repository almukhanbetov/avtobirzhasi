"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AuthStatus() {
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (status === "authenticated" && user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-2 text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground"
        >
          <User size={18} />
          {user.name}
        </button>

        {open ? (
          <>
            {/* Invisible full-screen backdrop to close the menu on outside click. */}
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div className="absolute right-0 z-50 mt-2 flex w-52 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-[14px] font-medium text-foreground hover:bg-black/[0.04]"
              >
                Личный кабинет
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                  router.push("/");
                }}
                className="flex items-center gap-2 border-t border-border px-4 py-3 text-left text-[14px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
              >
                <LogOut size={15} />
                Выйти
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center gap-2 text-[15px] font-medium text-foreground/80 transition-colors hover:text-foreground"
    >
      <User size={18} />
      Войти
    </Link>
  );
}
