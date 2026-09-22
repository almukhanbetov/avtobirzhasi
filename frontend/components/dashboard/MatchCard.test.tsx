import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { MatchCard } from "./MatchCard";
import type { Car } from "@/types/car";
import type { MatchDeal } from "@/types/dashboard";

// Единый номер администратора: once both deposits are confirmed, the
// dashboard is the one place the site actually surfaces the contact —
// and it must be the admin number, driven purely by `match.status`
// already present on this already-loaded object (no extra fetch, no
// per-counterpart phone field involved at all any more).

const car: Car = {
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

function baseMatch(overrides: Partial<MatchDeal> = {}): MatchDeal {
  return {
    id: "match-1",
    car,
    finalPrice: 8_800_000,
    depositAmount: 88_000,
    sellerDepositPaid: true,
    buyerDepositPaid: true,
    deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    status: "confirmed",
    role: "buyer",
    ...overrides,
  };
}

function renderCard(match: MatchDeal) {
  return render(
    <LanguageProvider>
      <MatchCard match={match} />
    </LanguageProvider>,
  );
}

describe("MatchCard — confirmed match", () => {
  it("shows the admin contact link dialing the required number", () => {
    renderCard(baseMatch({ status: "confirmed" }));
    const link = screen.getByRole("link", { name: /702 789 7120/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
  });
});

describe("MatchCard — not yet confirmed", () => {
  it("a match still awaiting the caller's own deposit does not show admin contact", () => {
    renderCard(
      baseMatch({
        role: "buyer",
        buyerDepositPaid: false,
        sellerDepositPaid: true,
        status: "seller_deposit_paid",
      }),
    );
    expect(screen.queryByRole("link", { name: /702 789 7120/ })).toBeNull();
  });

  it("an expired match does not show admin contact", () => {
    renderCard(
      baseMatch({
        status: "expired",
        sellerDepositPaid: false,
        buyerDepositPaid: false,
      }),
    );
    expect(screen.queryByRole("link", { name: /702 789 7120/ })).toBeNull();
  });
});
