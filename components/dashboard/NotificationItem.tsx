import { Check, GitMerge, Lock, Unlock, Wallet, type LucideIcon } from "lucide-react";
import { notificationLabels } from "@/lib/labels/dashboard";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/dashboard";

const iconByType: Record<NotificationType, LucideIcon> = {
  match_found: GitMerge,
  deposit_required: Wallet,
  deposit_received: Check,
  contacts_open: Unlock,
  match_expired: Lock,
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead?: () => void;
}) {
  const Icon = iconByType[notification.type];
  const className = cn(
    "flex w-full items-start gap-3 rounded-2xl border border-border p-4 text-left sm:p-5",
    notification.read ? "bg-surface" : "bg-brand-light",
  );

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">
        <Icon size={18} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-foreground">
            {notificationLabels[notification.type]}
          </span>
          {!notification.read ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-brand"
              aria-label="Непрочитано"
            />
          ) : null}
        </div>
        <p className="text-[14px] text-muted-foreground">
          {notification.message}
        </p>
        <span className="text-[12px] text-muted-foreground">
          {dateFormatter.format(new Date(notification.date))}
        </span>
      </div>
    </>
  );

  // Only unread notifications are clickable — read ones have nothing left
  // to do, so they render as a plain (non-interactive) div.
  if (!notification.read && onMarkRead) {
    return (
      <button
        type="button"
        onClick={onMarkRead}
        className={cn(className, "transition-colors hover:border-foreground/20")}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
