import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { navLinks } from "@/components/layout/nav-links";
import SellPage from "./page";

// Stage 9Б-21: /sell is a new informational landing page for the "Продать"
// nav item — it must never duplicate ListingForm/the actual submit flow,
// only link to the existing /sell/new. This suite checks the required
// first-screen copy, all five step cards, the CTA's target route, and
// that the two removed mechanisms from Stage 9Б-15/17 ("Обычная продажа",
// "Показать номер") don't somehow reappear here.

function renderPage() {
  return render(
    <LanguageProvider>
      <SellPage />
    </LanguageProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

describe("SellPage", () => {
  it("the 'Продать' nav item points at /sell", () => {
    const sellLink = navLinks.find((link) => link.labelKey === "nav.sell");
    expect(sellLink?.href).toBe("/sell");
  });

  it("renders the required first-screen title, description and CTA", () => {
    renderPage();
    expect(screen.getByText("Продайте автомобиль через Автобиржу")).toBeTruthy();
    expect(
      screen.getByText(
        "Укажите автомобиль и желаемую цену. Автобиржа автоматически поможет найти покупателя, когда ваши ценовые предложения сблизятся.",
      ),
    ).toBeTruthy();
    const cta = screen.getByRole("link", { name: "Подать объявление" });
    expect(cta.getAttribute("href")).toBe("/sell/new");
  });

  it("renders all five steps of 'Как проходит продажа', once each", () => {
    renderPage();
    const titles = [
      "Разместите автомобиль",
      "Цена автоматически снижается",
      "Автобиржа находит покупателя",
      "Внесите депозит",
      "Получите контакт покупателя",
    ];
    for (const title of titles) {
      expect(screen.getAllByText(title)).toHaveLength(1);
    }
  });

  it("does not offer 'Обычная продажа' or a 'Показать номер' shortcut", () => {
    renderPage();
    expect(screen.queryByText("Обычная продажа")).toBeNull();
    expect(screen.queryByText("Показать номер")).toBeNull();
  });

  it("renders a real Kazakh title, not the raw key", async () => {
    localStorage.setItem("avtobirzhasi_lang", "kz");
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Автокөлікті Автобиржа арқылы сатыңыз")).toBeTruthy(),
    );
    expect(screen.queryByText("sell.hero.title")).toBeNull();
  });
});
