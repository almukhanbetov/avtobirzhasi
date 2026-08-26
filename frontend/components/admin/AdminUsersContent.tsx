"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { listAdminUsers } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function AdminUsersContent() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", search, page],
    queryFn: () => listAdminUsers(token!, { search: search || undefined, page }),
    enabled: !!token,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("admin.users.title")}
        </h1>
        <p className="text-[15px] text-muted-foreground">{t("admin.users.subtitle")}</p>
      </div>

      <div className="max-w-sm">
        <Input
          label={t("admin.users.searchLabel")}
          placeholder={t("admin.users.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState title={t("admin.users.loadErrorTitle")} description={t("cars.empty.error.description")} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3">
            {data.items.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[15px] font-semibold text-foreground">{user.name}</span>
                    {user.role === "admin" ? <Badge variant="brand">admin</Badge> : null}
                  </div>
                  <span className="text-[13px] text-muted-foreground">
                    {user.phone} · {user.since}
                  </span>
                </div>
                <span className="text-[13px] text-muted-foreground">
                  ★ {user.rating.toFixed(1)} ({user.reviewsCount})
                </span>
              </div>
            ))}
          </div>
          <AdminPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} disabled={isLoading} />
        </>
      ) : (
        <EmptyState title={t("admin.users.emptyTitle")} description={t("admin.users.emptyDescription")} />
      )}
    </div>
  );
}
