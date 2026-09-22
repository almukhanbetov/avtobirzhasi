import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { VehiclePriceSidebar } from "./VehiclePriceSidebar";
import type { Car } from "@/types/car";
import type { Seller } from "@/types/seller";

// Единый номер администратора: the admin contact affordance now lives
// only in SellerCard.tsx (see SellerCard.test.tsx) — shown once per
// listing page, for every listing, exchange or not. This sidebar stays
// scoped to price/status only, for both branches, so nothing here should
// ever render a phone number, admin or otherwise.

const baseCar: Car = {
  id: "car-1",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  price: 9_000_000,
  mileageKm: 45_000,
  region: "Алматы",
  transmission: "automatic",
  fuelType: "petrol",
  bodyType: "sedan",
  drivetrain: "fwd",
  engineVolume: 2.5,
  enginePower: 181,
  color: "белый",
  steeringWheel: "left",
  imageUrl: "https://x/a.jpg",
  images: ["https://x/a.jpg"],
  sellerId: "seller-1",
};

const seller: Seller = {
  id: "seller-1",
  name: "Иван Продавцов",
  type: "private",
  since: "с 2024 года",
  rating: 4.8,
  reviewsCount: 12,
  activeListings: 3,
};

function renderSidebar(car: Car) {
  return render(
    <LanguageProvider>
      <VehiclePriceSidebar car={car} seller={seller} />
    </LanguageProvider>,
  );
}

describe("VehiclePriceSidebar — classified (non-exchange) listing", () => {
  it("shows price and seller type, no phone number of any kind", () => {
    renderSidebar(baseCar);
    expect(screen.getByText("Цена")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /702 789 7120/ })).toBeNull();
    expect(screen.queryByText("Связаться с администратором")).toBeNull();
    // Seller has no .phone field at all (see types/seller.ts) — belt and
    // suspenders check that nothing here invents one.
    expect(screen.queryByText(/^\+7\d{10}$/)).toBeNull();
  });
});

describe("VehiclePriceSidebar — exchange listing", () => {
  const exchangeCar: Car = {
    ...baseCar,
    isExchange: true,
    exchangeRole: "seller",
    dailyChangePercent: -1,
  };

  it("does not show any admin contact link on the listing page itself", () => {
    renderSidebar(exchangeCar);
    expect(screen.queryByRole("link", { name: /702 789 7120/ })).toBeNull();
    expect(screen.queryByText("Связаться с администратором")).toBeNull();
  });
});
