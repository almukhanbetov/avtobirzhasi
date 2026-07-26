"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestRow } from "@/components/dashboard/RequestRow";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyRequests } from "@/lib/api/requests";

export function RequestsContent() {
  const { token } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "requests"],
    queryFn: () => listMyRequests(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Заявки на покупку
          </h1>
          <p className="text-[15px] text-muted-foreground">
            Ваши заявки на Автобирже и текущее предложение по ним.
          </p>
        </div>
        <Button href="/exchange/new">Создать заявку</Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить заявки"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="У вас пока нет заявок на покупку."
          description="Создайте заявку, и Автобиржа будет искать подходящий автомобиль автоматически."
          secondaryHref="/exchange/new"
          secondaryLabel="Создать заявку"
        />
      )}
    </div>
  );
}
