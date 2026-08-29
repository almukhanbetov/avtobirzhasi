import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { BuyQrDeposit } from "./BuyQrDeposit";

function renderBlock() {
  return render(
    <LanguageProvider>
      <BuyQrDeposit />
    </LanguageProvider>,
  );
}

describe("BuyQrDeposit", () => {
  it("shows the QR heading and the deposit instruction", () => {
    renderBlock();
    expect(screen.getByText("QR для внесения депозита")).toBeTruthy();
    expect(
      screen.getByText(/1% от текущей цены выбранного автомобиля/),
    ).toBeTruthy();
  });

  it("renders the QR image from the local public path (not a remote URL)", () => {
    const { container } = renderBlock();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    // next/image rewrites the src; the local file path must still be in it.
    expect(img?.getAttribute("src")).toContain("halyk-qr");
    expect(img?.getAttribute("src")?.startsWith("http")).toBe(false);
  });

  it("renders a clickable tel: link to +77027897120", () => {
    renderBlock();
    const link = screen.getByRole("link", { name: /702 789 71 20/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
  });

  it("has real Kazakh strings (not a fallback to the key name)", async () => {
    localStorage.setItem("avtobirzhasi_lang", "kz");
    renderBlock();
    await waitFor(() =>
      expect(screen.getByText("Депозит төлеуге арналған QR")).toBeTruthy(),
    );
    // the key name itself must never be what renders
    expect(screen.queryByText("buy.qr.title")).toBeNull();
  });
});

afterEach(() => {
  localStorage.clear();
});
