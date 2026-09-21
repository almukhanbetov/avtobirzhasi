import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import HowItWorksPage from "./page";

// Stage 9Б-20: /how-it-works reuses ExchangeExplainer as-is — the exact
// same "Как работает Автобиржа" section already on the homepage (same
// diagram, same four step cards) — and nothing else. BuyingWays was
// removed from this page in this stage; it stays on / and /buy
// unchanged, so it isn't (and must not be) asserted here.

function renderPage() {
  return render(
    <LanguageProvider>
      <HowItWorksPage />
    </LanguageProvider>,
  );
}

describe("HowItWorksPage", () => {
  it("renders the Auto Exchange heading and mechanism description", () => {
    renderPage();
    expect(screen.getByText("Как работает Автобиржа")).toBeTruthy();
    expect(
      screen.getByText(
        "Автоматический механизм, который сводит покупателя и продавца, когда их цены встречаются.",
      ),
    ).toBeTruthy();
  });

  it("renders the price-convergence diagram (seller −1%/day, buyer +1%/day, Match ≈2%)", () => {
    renderPage();
    expect(screen.getByText("Продавец: −1% в сутки")).toBeTruthy();
    expect(screen.getByText("Покупатель: +1% в сутки")).toBeTruthy();
    expect(screen.getByText("Match ≈2%")).toBeTruthy();
  });

  it("renders all four step cards, once each", () => {
    renderPage();
    for (const title of ["Цены сближаются", "Match и заморозка", "Депозит 1%", "Контакты открыты"]) {
      expect(screen.getAllByText(title)).toHaveLength(1);
    }
  });

  it("does not render the BuyingWays 'two ways to buy' section", () => {
    renderPage();
    expect(screen.queryByText("Купить сейчас по текущей цене")).toBeNull();
    expect(screen.queryByText("Купить через Автобиржу")).toBeNull();
    expect(screen.queryByText("Два способа купить автомобиль")).toBeNull();
  });
});
