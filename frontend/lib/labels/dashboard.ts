import type {
  DepositStatus,
  ListingStatus,
  MatchStatus,
  NotificationType,
} from "@/types/dashboard";
import type { Lang } from "@/lib/i18n/translations";

type Variant = "brand" | "neutral" | "success" | "warning" | "destructive";

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
    awaiting_deposit: "Ожидается оплата комиссии",
    seller_deposit_paid: "Комиссия продавца оплачена",
    buyer_deposit_paid: "Комиссия покупателя оплачена",
    confirmed: "Сделка подтверждена",
    expired: "Истёк срок",
    cancelled: "Отменено",
  },
  kz: {
    awaiting_deposit: "Комиссия төлемі күтілуде",
    seller_deposit_paid: "Сатушының комиссиясы төленді",
    buyer_deposit_paid: "Сатып алушының комиссиясы төленді",
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
    paid: { label: "Оплачена", variant: "success" },
    refunded: { label: "Возвращена", variant: "neutral" },
    failed: { label: "Платёж не прошёл", variant: "destructive" },
    amount_mismatch: { label: "На проверке", variant: "warning" },
  },
  kz: {
    pending: { label: "Төлем күтілуде", variant: "warning" },
    paid: { label: "Төленді", variant: "success" },
    refunded: { label: "Қайтарылды", variant: "neutral" },
    failed: { label: "Төлем өтпеді", variant: "destructive" },
    amount_mismatch: { label: "Тексерісте", variant: "warning" },
  },
};

export const notificationLabels: Record<Lang, Record<NotificationType, string>> = {
  ru: {
    match_found: "Match найден",
    deposit_required: "Нужно оплатить комиссию",
    deposit_received: "Комиссия получена",
    contacts_open: "Контакты открыты",
    match_expired: "Срок Match истёк",
  },
  kz: {
    match_found: "Match табылды",
    deposit_required: "Комиссияны төлеу қажет",
    deposit_received: "Комиссия алынды",
    contacts_open: "Байланыстар ашылды",
    match_expired: "Match мерзімі өтті",
  },
};
