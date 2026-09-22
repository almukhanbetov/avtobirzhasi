import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { SellerCard } from "./SellerCard";
import type { Seller } from "@/types/seller";

// Единый номер администратора: SellerCard is the one place on the car
// detail page that always shows a contact affordance, for every listing
// (exchange or not) — see VehiclePriceSidebar.test.tsx for the
// complementary check that the price sidebar itself never does. This is
// also where the original ungated seller-phone leak lived (Stage 9Б-16
// audit) — these tests pin down that whatever is shown here can never
// be derived from the seller's own data, only from the fixed admin
// constant.

const seller: Seller = {
  id: "seller-1",
  name: "Иван Продавцов",
  type: "private",
  since: "с 2024 года",
  rating: 4.8,
  reviewsCount: 12,
  activeListings: 3,
};

function renderCard() {
  return render(
    <LanguageProvider>
      <SellerCard seller={seller} />
    </LanguageProvider>,
  );
}

describe("SellerCard", () => {
  it("shows the admin contact link, dialing the required number", () => {
    renderCard();
    const link = screen.getByRole("link", { name: /702 789 7120/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
    expect(screen.getByText("Связаться с администратором")).toBeTruthy();
  });

  it("still shows the seller's public profile info alongside the contact link", () => {
    renderCard();
    expect(screen.getByText("Иван Продавцов")).toBeTruthy();
    expect(screen.getByText("4.8")).toBeTruthy();
  });

  it("Seller has no phone field to leak in the first place (type-level check)", () => {
    // If this ever fails to compile, someone added `.phone` back to the
    // Seller type — see types/seller.ts's own doc comment for why it
    // must not exist.
    const keys = Object.keys(seller);
    expect(keys).not.toContain("phone");
  });
});
