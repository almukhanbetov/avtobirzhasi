import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { QuickSearch } from "./QuickSearch";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockClear();
});

function renderQuickSearch() {
  return render(
    <LanguageProvider>
      <QuickSearch />
    </LanguageProvider>,
  );
}

describe("QuickSearch", () => {
  it("navigates to a bare /cars when nothing is selected", () => {
    renderQuickSearch();
    fireEvent.submit(screen.getByRole("button", { name: /найти/i }).closest("form")!);
    expect(push).toHaveBeenCalledWith("/cars");
  });

  it("builds the real /api/cars filter params the catalog understands", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/регион/i), { target: { value: "Алматы" } });
    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "Camry" } });

    fireEvent.submit(screen.getByRole("button", { name: /найти/i }).closest("form")!);

    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/cars");
    expect(url.searchParams.get("region")).toBe("Алматы");
    expect(url.searchParams.get("make")).toBe("Toyota");
    expect(url.searchParams.get("model")).toBe("Camry");
  });

  it("splits a selected price range into priceFrom/priceTo", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/цена/i), { target: { value: "5000000-10000000" } });
    fireEvent.submit(screen.getByRole("button", { name: /найти/i }).closest("form")!);

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("priceFrom")).toBe("5000000");
    expect(url.searchParams.get("priceTo")).toBe("10000000");
  });

  it("trims a free-typed model before adding it to the URL", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "  Rio  " } });
    fireEvent.submit(screen.getByRole("button", { name: /найти/i }).closest("form")!);

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("model")).toBe("Rio");
  });
});
