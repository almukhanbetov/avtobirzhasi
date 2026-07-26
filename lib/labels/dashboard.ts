import type {
  DepositStatus,
  ListingStatus,
  MatchStatus,
  NotificationType,
} from "@/types/dashboard";

export const listingStatusLabels: Record<
  ListingStatus,
  { label: string; variant: "brand" | "neutral" | "success" | "warning" }
> = {
  active: { label: "Активно", variant: "success" },
  frozen: { label: "Заморожено", variant: "brand" },
  moderation: { label: "На модерации", variant: "warning" },
  archived: { label: "В архиве", variant: "neutral" },
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  awaiting_deposit: "Ожидается депозит",
  seller_deposit_paid: "Депозит продавца внесён",
  buyer_deposit_paid: "Депозит покупателя внесён",
  confirmed: "Сделка подтверждена",
  expired: "Истёк срок",
  cancelled: "Отменено",
};

export const depositStatusLabels: Record<
  DepositStatus,
  { label: string; variant: "brand" | "neutral" | "success" | "warning" }
> = {
  pending: { label: "Ожидает оплаты", variant: "warning" },
  paid: { label: "Оплачен", variant: "success" },
  refunded: { label: "Возвращён", variant: "neutral" },
};

export const notificationLabels: Record<NotificationType, string> = {
  match_found: "Match найден",
  deposit_required: "Нужно внести депозит",
  deposit_received: "Депозит получен",
  contacts_open: "Контакты открыты",
  match_expired: "Срок Match истёк",
};
