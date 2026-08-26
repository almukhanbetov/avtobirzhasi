import type {
  DepositStatus,
  ListingStatus,
  MatchStatus,
  NotificationType,
} from "@/types/dashboard";
import type { Lang } from "@/lib/i18n/translations";

type Variant = "brand" | "neutral" | "success" | "warning";

export const listingStatusLabels: Record<
  Lang,
  Record<ListingStatus, { label: string; variant: Variant }>
> = {
  ru: {
    active: { label: "Активно", variant: "success" },
    frozen: { label: "Заморожено", variant: "brand" },
    moderation: { label: "На модерации", variant: "warning" },
    archived: { label: "В архиве", variant: "neutral" },
  },
  kz: {
    active: { label: "Белсенді", variant: "success" },
    frozen: { label: "Тоқтатылды", variant: "brand" },
    moderation: { label: "Модерацияда", variant: "warning" },
    archived: { label: "Мұрағатта", variant: "neutral" },
  },
};

export const matchStatusLabels: Record<Lang, Record<MatchStatus, string>> = {
  ru: {
    awaiting_deposit: "Ожидается депозит",
    seller_deposit_paid: "Депозит продавца внесён",
    buyer_deposit_paid: "Депозит покупателя внесён",
    confirmed: "Сделка подтверждена",
    expired: "Истёк срок",
    cancelled: "Отменено",
  },
  kz: {
    awaiting_deposit: "Депозит күтілуде",
    seller_deposit_paid: "Сатушының депозиті төленді",
    buyer_deposit_paid: "Сатып алушының депозиті төленді",
    confirmed: "Мәміле расталды",
    expired: "Мерзімі өтті",
    cancelled: "Болдырылмады",
  },
};

export const depositStatusLabels: Record<
  Lang,
  Record<DepositStatus, { label: string; variant: Variant }>
> = {
  ru: {
    pending: { label: "Ожидает оплаты", variant: "warning" },
    paid: { label: "Оплачен", variant: "success" },
    refunded: { label: "Возвращён", variant: "neutral" },
  },
  kz: {
    pending: { label: "Төлем күтілуде", variant: "warning" },
    paid: { label: "Төленді", variant: "success" },
    refunded: { label: "Қайтарылды", variant: "neutral" },
  },
};

export const notificationLabels: Record<Lang, Record<NotificationType, string>> = {
  ru: {
    match_found: "Match найден",
    deposit_required: "Нужно внести депозит",
    deposit_received: "Депозит получен",
    contacts_open: "Контакты открыты",
    match_expired: "Срок Match истёк",
  },
  kz: {
    match_found: "Match табылды",
    deposit_required: "Депозит салу қажет",
    deposit_received: "Депозит алынды",
    contacts_open: "Байланыстар ашылды",
    match_expired: "Match мерзімі өтті",
  },
};
