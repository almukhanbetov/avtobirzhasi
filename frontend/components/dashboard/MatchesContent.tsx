"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { MatchCard } from "@/components/dashboard/MatchCard";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyMatches } from "@/lib/api/matches";

export function MatchesContent() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "matches"],
    queryFn: () => listMyMatches(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Matches
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Совпадения между вашими объявлениями и заявками других
          пользователей.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить Match"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Пока нет активных Match."
          description="Как только цена продавца и покупателя сойдутся примерно до 2%, здесь появится совпадение."
        />
      )}
    </div>
  );
}
