"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { navLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { user, status, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const isDark = theme === "dark";

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface px-6 py-6 shadow-sm">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-black/[0.04]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDark}
              className="flex items-center gap-2 px-3 text-left text-[15px] font-medium text-foreground"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              {isDark ? "Светлая тема" : "Тёмная тема"}
            </button>
            {status === "authenticated" && user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="px-3 text-[15px] font-medium text-foreground"
                >
                  {user.name}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                    router.push("/");
                  }}
                  className="flex items-center gap-2 px-3 text-left text-[15px] font-medium text-muted-foreground"
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="px-3 text-[15px] font-medium text-foreground"
              >
                Войти
              </Link>
            )}
            <Button href="/sell/new" className="w-full">
              Подать объявление
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
