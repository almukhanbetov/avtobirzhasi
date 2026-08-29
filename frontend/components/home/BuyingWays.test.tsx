import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BuyingWays } from "./BuyingWays";

function renderWays(props?: { withQrDeposit?: boolean }) {
  return render(
    <LanguageProvider>
      <BuyingWays {...props} />
    </LanguageProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
});

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

describe("BuyingWays — QR deposit area (withQrDeposit, /buy only)", () => {
  it("does NOT render the QR by default (homepage)", () => {
    const { container } = renderWays();
    expect(container.querySelector('img[src="/images/halyk-qr.jpg"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /702 789 71 20/ })).toBeNull();
  });

  it("renders exactly one plain <img> QR inside the left card when enabled", () => {
    const { container } = renderWays({ withQrDeposit: true });
    const imgs = container.querySelectorAll('img[src="/images/halyk-qr.jpg"]');
    expect(imgs).toHaveLength(1);
    const img = imgs[0];
    // plain <img>: no next/image markers
    expect(img.hasAttribute("data-nimg")).toBe(false);
    expect(img.getAttribute("loading")).not.toBe("lazy");
    expect(img.getAttribute("src")?.startsWith("http")).toBe(false);

    // it sits inside the left ("Купить сейчас...") card, not the right one
    const leftCard = screen
      .getByText("Купить сейчас по текущей цене")
      .closest("div.rounded-2xl.border");
    expect(leftCard).not.toBeNull();
    expect(leftCard?.contains(img)).toBe(true);
    const rightCard = screen
      .getByText("Купить через Автобиржу")
      .closest("div.rounded-2xl.border");
    expect(rightCard?.contains(img)).toBe(false);
  });

  it("shows the QR caption and a clickable tel: phone", () => {
    renderWays({ withQrDeposit: true });
    expect(screen.getByText("Внесите 1% от текущей цены по QR")).toBeTruthy();
    const link = screen.getByRole("link", { name: /702 789 71 20/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
  });

  it("uses a real Kazakh caption, not the raw key", async () => {
    localStorage.setItem("avtobirzhasi_lang", "kz");
    renderWays({ withQrDeposit: true });
    await waitFor(() =>
      expect(screen.getByText("QR арқылы ағымдағы бағаның 1%-ын төлеңіз")).toBeTruthy(),
    );
    expect(screen.queryByText("buy.qr.text")).toBeNull();
  });
});
