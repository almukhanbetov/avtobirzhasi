import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listMyDeposits, payDeposit } from "@/lib/api/deposits";
import type { Deposit } from "@/types/dashboard";
import { DepositsContent } from "./DepositsContent";

vi.mock("@/lib/api/deposits", () => ({
  listMyDeposits: vi.fn(),
  payDeposit: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "user-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeDeposit(overrides: Partial<Deposit> = {}): Deposit {
  return {
    id: "deposit-1",
    matchId: "match-1",
    car: {
      id: "car-1",
      make: "Toyota",
      model: "Camry",
      year: 2020,
      price: 10_000_000,
      mileageKm: 10000,
      region: "Алматы",
      transmission: "automatic",
      fuelType: "petrol",
      bodyType: "sedan",
      drivetrain: "fwd",
      engineVolume: 2.5,
      enginePower: 180,
      color: "белый",
      steeringWheel: "left",
      imageUrl: "/car.jpg",
      images: ["/car.jpg"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    amount: 100_000,
    status: "pending",
    provider: "mock",
    date: "2026-08-26",
    ...overrides,
  };
}

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DepositsContent />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listMyDeposits).mockReset();
  vi.mocked(payDeposit).mockReset();
});

describe("DepositsContent", () => {
  it("shows the mock-mode notice when every deposit is on the mock provider", async () => {
    vi.mocked(listMyDeposits).mockResolvedValue([fakeDeposit({ provider: "mock" })]);
    renderContent();
    expect(await screen.findByText(/Тестовый режим/)).toBeTruthy();
  });

  it("shows the real-provider notice once a deposit is on a real gateway", async () => {
    vi.mocked(listMyDeposits).mockResolvedValue([fakeDeposit({ provider: "freedompay" })]);
    renderContent();
    expect(await screen.findByText(/FreedomPay/)).toBeTruthy();
  });

  it("invalidates and refreshes in place when the provider resolves synchronously (mock)", async () => {
    vi.mocked(listMyDeposits).mockResolvedValue([fakeDeposit()]);
    vi.mocked(payDeposit).mockResolvedValue({ id: "deposit-1", status: "paid", matchStatus: "confirmed" });
    renderContent();

    const payButton = await screen.findByText("Оплатить");
    fireEvent.click(payButton);

    await waitFor(() => expect(payDeposit).toHaveBeenCalledWith("user-token", "deposit-1"));
  });

  it("redirects the browser when the provider returns a hosted payment page", async () => {
    vi.mocked(listMyDeposits).mockResolvedValue([fakeDeposit({ provider: "freedompay" })]);
    vi.mocked(payDeposit).mockResolvedValue({ redirectUrl: "https://pay.freedompay.kz/session/123" });

    const originalLocation = window.location;
    // jsdom's window.location isn't directly assignable — replace it for
    // this test only via defineProperty, restoring the original
    // afterwards. Image rendering (next/image) resolves relative URLs
    // against window.location.href, so it must start out as a real,
    // valid URL, not "".
    const mockLocation = { ...originalLocation, href: originalLocation.href };
    Object.defineProperty(window, "location", { value: mockLocation, writable: true, configurable: true });

    renderContent();
    const payButton = await screen.findByText("Оплатить");
    fireEvent.click(payButton);

    await waitFor(() => expect(window.location.href).toBe("https://pay.freedompay.kz/session/123"));

    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });
});
