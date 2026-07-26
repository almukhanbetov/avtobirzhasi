"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  FileText,
  Gauge,
  GitMerge,
  Heart,
  LayoutGrid,
  LogOut,
  User,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthProvider";

const navItems = [
  { href: "/dashboard", label: "Обзор", icon: Gauge, exact: true },
  { href: "/dashboard/listings", label: "Мои объявления", icon: LayoutGrid },
  { href: "/dashboard/requests", label: "Заявки на покупку", icon: FileText },
  { href: "/dashboard/matches", label: "Matches", icon: GitMerge },
  { href: "/dashboard/deposits", label: "Депозиты", icon: Wallet },
  { href: "/dashboard/favorites", label: "Избранное", icon: Heart },
  { href: "/dashboard/notifications", label: "Уведомления", icon: Bell },
  { href: "/dashboard/profile", label: "Профиль", icon: User },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // DashboardGuard only renders this once status === "authenticated", so
  // user is always set in practice — this is just to satisfy the type.
  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <>
      <div className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-black/[0.04]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-[14px] font-semibold text-brand">
            {initials}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold text-foreground">
              {user.name}
            </span>
            <span className="text-[12px] text-muted-foreground">
              Открыть профиль
            </span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-brand-light text-brand-dark"
                    : "text-foreground/80 hover:bg-black/[0.04]",
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl border-t border-border px-4 pt-4 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut size={18} />
          Выйти
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <Link
            href="/dashboard/profile"
            className="flex min-w-0 items-center gap-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-[12px] font-semibold text-brand">
              {initials}
            </span>
            <span className="truncate text-[14px] font-semibold text-foreground">
              {user.name}
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-muted-foreground"
          >
            <LogOut size={15} />
            Выйти
          </button>
        </div>

        <nav className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-light text-brand-dark"
                    : "border-border bg-surface text-foreground/80",
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
