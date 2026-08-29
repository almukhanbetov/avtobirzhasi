import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BuyingWays } from "./BuyingWays";

function renderWays() {
  return render(
    <LanguageProvider>
      <BuyingWays />
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

describe("BuyingWays — Halyk QR deposit area (same on homepage and /buy)", () => {
  it("renders exactly one plain <img> QR, inside the LEFT card only", () => {
    const { container } = renderWays();
    const imgs = container.querySelectorAll('img[src="/images/halyk-qr.jpg"]');
    expect(imgs).toHaveLength(1);
    const img = imgs[0];
    // plain <img>: no next/image markers, no lazy
    expect(img.hasAttribute("data-nimg")).toBe(false);
    expect(img.getAttribute("loading")).not.toBe("lazy");
    expect(img.getAttribute("src")?.startsWith("http")).toBe(false);

    const leftCard = screen
      .getByText("Купить сейчас по текущей цене")
      .closest("div.rounded-2xl.border");
    const rightCard = screen
      .getByText("Купить через Автобиржу")
      .closest("div.rounded-2xl.border");
    expect(leftCard?.contains(img)).toBe(true);
    expect(rightCard?.contains(img)).toBe(false);
  });

  it("places the QR after the bullet list and before the CTA", () => {
    renderWays();
    const leftCard = screen
      .getByText("Купить сейчас по текущей цене")
      .closest("div.rounded-2xl.border")!;
    const ul = leftCard.querySelector("ul")!;
    const img = leftCard.querySelector('img[src="/images/halyk-qr.jpg"]')!;
    const cta = screen.getByRole("link", { name: /Смотреть автомобили/ });
    // DOCUMENT_POSITION_FOLLOWING (4) means the arg comes after the node
    expect(ul.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(img.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the QR caption and a clickable tel: phone", () => {
    renderWays();
    expect(screen.getByText("Внесите 1% от текущей цены по QR")).toBeTruthy();
    const link = screen.getByRole("link", { name: /702 789 71 20/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
  });

  it("uses a real Kazakh caption, not the raw key", async () => {
    localStorage.setItem("avtobirzhasi_lang", "kz");
    renderWays();
    await waitFor(() =>
      expect(screen.getByText("QR арқылы ағымдағы бағаның 1%-ын төлеңіз")).toBeTruthy(),
    );
    expect(screen.queryByText("buy.qr.text")).toBeNull();
  });
});
