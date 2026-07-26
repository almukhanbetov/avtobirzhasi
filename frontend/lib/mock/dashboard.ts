import { mockCars } from "@/lib/mock/cars";
import type {
  BuyerRequest,
  Deposit,
  MatchDeal,
  Notification,
  SellerListing,
} from "@/types/dashboard";

function carById(id: string) {
  const car = mockCars.find((item) => item.id === id);
  if (!car) throw new Error(`Mock car not found: ${id}`);
  return car;
}

export const mySellerListings: SellerListing[] = [
  {
    id: "listing-1",
    car: carById("car-1"),
    status: "active",
    updatedAt: "2026-07-20",
  },
  {
    id: "listing-2",
    car: carById("car-14"),
    status: "frozen",
    updatedAt: "2026-07-24",
  },
  {
    id: "listing-3",
    car: carById("car-16"),
    status: "moderation",
    updatedAt: "2026-07-25",
  },
];

export const myBuyerRequests: BuyerRequest[] = [
  {
    id: "request-1",
    make: "Toyota",
    model: "RAV4",
    yearFrom: 2021,
    yearTo: 2023,
    region: "Алматы",
    currentOffer: 16_100_000,
    status: "active",
    updatedAt: "2026-07-23",
  },
];

export const myMatches: MatchDeal[] = [
  {
    id: "match-1",
    car: carById("car-14"),
    finalPrice: 23_400_000,
    depositAmount: 234_000,
    sellerDepositPaid: false,
    buyerDepositPaid: true,
    deadline: "2026-07-27T18:00:00",
    status: "buyer_deposit_paid",
    role: "seller",
  },
  {
    id: "match-2",
    car: carById("car-19"),
    finalPrice: 13_500_000,
    depositAmount: 135_000,
    sellerDepositPaid: true,
    buyerDepositPaid: true,
    deadline: "2026-07-25T12:00:00",
    status: "confirmed",
    role: "buyer",
  },
];

export const myDeposits: Deposit[] = [
  {
    id: "deposit-1",
    matchId: "match-1",
    car: carById("car-14"),
    amount: 234_000,
    status: "pending",
    date: "2026-07-25",
  },
  {
    id: "deposit-2",
    matchId: "match-2",
    car: carById("car-19"),
    amount: 135_000,
    status: "paid",
    date: "2026-07-22",
  },
  {
    id: "deposit-3",
    matchId: "match-0",
    car: carById("car-9"),
    amount: 54_000,
    status: "refunded",
    date: "2026-07-10",
  },
];

export const myFavoriteCarIds = ["car-3", "car-5", "car-15", "car-17"];

export const myFavorites = mockCars.filter((car) =>
  myFavoriteCarIds.includes(car.id),
);

export const myNotifications: Notification[] = [
  {
    id: "notif-1",
    type: "deposit_required",
    message: "Внесите депозит по сделке BMW 5-Series — осталось 18 часов.",
    date: "2026-07-25T09:00:00",
    read: false,
  },
  {
    id: "notif-2",
    type: "contacts_open",
    message: "Контакты по сделке Kia K5 открыты — можно связаться со стороной.",
    date: "2026-07-22T14:30:00",
    read: false,
  },
  {
    id: "notif-3",
    type: "deposit_received",
    message: "Депозит по сделке Kia K5 получен и подтверждён.",
    date: "2026-07-22T11:15:00",
    read: true,
  },
  {
    id: "notif-4",
    type: "match_found",
    message: "Найден Match для вашей заявки на Toyota RAV4.",
    date: "2026-07-20T17:45:00",
    read: true,
  },
  {
    id: "notif-5",
    type: "match_expired",
    message: "Срок Match по объявлению Chevrolet Cobalt истёк — объявление снова активно.",
    date: "2026-07-15T08:00:00",
    read: true,
  },
];
