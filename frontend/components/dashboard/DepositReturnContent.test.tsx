import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getDepositStatus } from "@/lib/api/deposits";
import { DepositReturnContent } from "./DepositReturnContent";

vi.mock("@/lib/api/deposits", () => ({
  getDepositStatus: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "user-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ depositId: "deposit-1" }),
}));

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DepositReturnContent />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getDepositStatus).mockReset();
});

describe("DepositReturnContent", () => {
  it("shows a verifying state while the deposit is still pending", async () => {
    vi.mocked(getDepositStatus).mockResolvedValue({ id: "deposit-1", status: "pending", matchStatus: "awaiting_deposit" });
    renderContent();
    expect(await screen.findByText(/Проверяем статус оплаты/)).toBeTruthy();
  });

  it("shows success once the server confirms the deposit is paid", async () => {
    vi.mocked(getDepositStatus).mockResolvedValue({ id: "deposit-1", status: "paid", matchStatus: "confirmed" });
    renderContent();
    expect(await screen.findByText("Оплата прошла успешно")).toBeTruthy();
  });

  it("shows failure when the server reports the payment failed — never trusts the redirect alone", async () => {
    vi.mocked(getDepositStatus).mockResolvedValue({ id: "deposit-1", status: "failed", matchStatus: "awaiting_deposit" });
    renderContent();
    expect(await screen.findByText("Оплата не прошла")).toBeTruthy();
  });
});
