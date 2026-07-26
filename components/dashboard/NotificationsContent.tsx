"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotificationItem } from "@/components/dashboard/NotificationItem";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyNotifications, markNotificationRead } from "@/lib/api/notifications";

export function NotificationsContent() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: () => listMyNotifications(token as string),
    enabled: Boolean(token),
  });

  // Marking a notification read also changes the dashboard overview's
  // "latest unread" task, so invalidate both.
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(token as string, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          Уведомления
        </h1>
        <p className="text-[15px] text-muted-foreground">
          Обновления по вашим объявлениям, заявкам и сделкам.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Не удалось загрузить уведомления"
          description="Сервер временно недоступен. Попробуйте обновить страницу через минуту."
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {data.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={() => markReadMutation.mutate(notification.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Уведомлений пока нет."
          description="Здесь появятся обновления по вашим объявлениям и сделкам."
        />
      )}
    </div>
  );
}
