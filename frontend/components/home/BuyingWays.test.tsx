import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BuyingWays } from "./BuyingWays";

function renderWays() {
  return render(
    <LanguageProvider>
      <BuyingWays />
    </LanguageProvider>,
  );
}

describe("BuyingWays — left 'buy now at current price' card", () => {
  it("uses the updated left-card title and keeps the same CTA target", () => {
    renderWays();
    expect(screen.getByText("Купить сейчас по текущей цене")).toBeTruthy();
    const cta = screen.getByRole("link", { name: /Смотреть автомобили/ });
    expect(cta.getAttribute("href")).toBe("/cars");
  });

  it("lists the four direct-purchase points", () => {
    renderWays();
    expect(screen.getByText("Покупка автомобиля по текущей цене")).toBeTruthy();
    expect(screen.getByText("Депозит — 1% от стоимости автомобиля")).toBeTruthy();
    expect(
      screen.getByText("После подтверждения депозита открывается контакт продавца"),
    ).toBeTruthy();
    expect(screen.getByText("Сделку можно начать сразу")).toBeTruthy();
  });

  it("leaves the right 'Купить через Автобиржу' card untouched", () => {
    renderWays();
    expect(screen.getByText("Купить через Автобиржу")).toBeTruthy();
    expect(
      screen.getByText("Цена продавца снижается, ваша — растёт"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Создать заявку на покупку/ }).getAttribute("href"),
    ).toBe("/exchange");
  });
});
