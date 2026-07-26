"use client";

import { useRouter } from "next/navigation";
import { LogOut, Mail, MapPin, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";

export function ProfileContent() {
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

  const fields = [
    { icon: Phone, label: "Телефон", value: user.phone },
    { icon: Mail, label: "Email", value: user.email ?? "Не указан" },
    { icon: MapPin, label: "Регион", value: user.region ?? "Не указан" },
    {
      icon: User,
      label: "Тип аккаунта",
      value: user.accountType === "dealer" ? "Автосалон" : "Частное лицо",
    },
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Профиль
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Вы вошли как{" "}
            <span className="font-medium text-foreground">{user.name}</span>
          </p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut size={17} />
          Выйти
        </Button>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-light text-xl font-semibold text-brand">
            {initials}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[18px] font-semibold text-foreground">
              {user.name}
            </span>
            <span className="text-[14px] text-muted-foreground">
              На сайте {user.since}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-border pt-6 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
                <field.icon size={17} />
              </span>
              <div className="flex flex-col">
                <span className="text-[12px] text-muted-foreground">
                  {field.label}
                </span>
                <span className="text-[15px] font-medium text-foreground">
                  {field.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
