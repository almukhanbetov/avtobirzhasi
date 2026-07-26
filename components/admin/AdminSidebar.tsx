"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardCheck,
  FileText,
  Gauge,
  GitMerge,
  LayoutGrid,
  Settings,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/admin/moderation", label: "Модерация объявлений", icon: ClipboardCheck },
  { href: "/admin/listings", label: "Все объявления", icon: LayoutGrid },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/requests", label: "Заявки на покупку", icon: FileText },
  { href: "/admin/matches", label: "Matches", icon: GitMerge },
  { href: "/admin/deposits", label: "Депозиты", icon: Wallet },
  { href: "/admin/notifications", label: "Уведомления", icon: Bell },
  { href: "/admin/reviews", label: "Отзывы", icon: Star },
  { href: "/admin/settings", label: "Настройки", icon: Settings },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <>
      <div className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        <div className="flex flex-col px-4 py-3">
          <span className="text-[14px] font-semibold text-foreground">
            Админка
          </span>
          <span className="text-[12px] text-muted-foreground">
            AVTOBIRZHASI.KZ
          </span>
        </div>

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
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        <div className="rounded-xl border border-border bg-surface px-4 py-3">
          <span className="text-[14px] font-semibold text-foreground">
            Админка
          </span>
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
