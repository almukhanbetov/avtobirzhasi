export type SellerType = "private" | "dealer";

export interface Seller {
  id: string;
  name: string;
  type: SellerType;
  since: string;
  rating: number;
  reviewsCount: number;
  activeListings: number;
  phone: string;
}

export const mockSellers: Seller[] = [
  {
    id: "seller-1",
    name: "Данияр К.",
    type: "private",
    since: "с 2023 года",
    rating: 4.8,
    reviewsCount: 12,
    activeListings: 1,
    phone: "+7 707 123 45 67",
  },
  {
    id: "seller-2",
    name: "Auto Plus Almaty",
    type: "dealer",
    since: "с 2019 года",
    rating: 4.9,
    reviewsCount: 236,
    activeListings: 48,
    phone: "+7 727 555 12 34",
  },
  {
    id: "seller-3",
    name: "Марат С.",
    type: "private",
    since: "с 2022 года",
    rating: 4.6,
    reviewsCount: 5,
    activeListings: 1,
    phone: "+7 701 987 65 43",
  },
  {
    id: "seller-4",
    name: "Astana Motors Trade",
    type: "dealer",
    since: "с 2016 года",
    rating: 4.7,
    reviewsCount: 512,
    activeListings: 87,
    phone: "+7 717 222 33 44",
  },
  {
    id: "seller-5",
    name: "Ержан Т.",
    type: "private",
    since: "с 2024 года",
    rating: 5.0,
    reviewsCount: 2,
    activeListings: 1,
    phone: "+7 705 456 78 90",
  },
  {
    id: "seller-6",
    name: "Shymkent Auto Hub",
    type: "dealer",
    since: "с 2020 года",
    rating: 4.5,
    reviewsCount: 143,
    activeListings: 34,
    phone: "+7 725 333 22 11",
  },
];

export function getSellerById(id: string): Seller {
  return mockSellers.find((seller) => seller.id === id) ?? mockSellers[0];
}
