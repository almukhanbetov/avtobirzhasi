import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listAdminUsers } from "@/lib/api/admin";
import type { AdminUserRow } from "@/types/admin";
import { AdminUsersContent } from "./AdminUsersContent";

vi.mock("@/lib/api/admin", () => ({
  listAdminUsers: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "admin-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "user-1",
    name: "Aidos Testov",
    phone: "+77011234567",
    accountType: "private",
    role: "user",
    rating: 5,
    reviewsCount: 0,
    since: "с 2026 года",
    ...overrides,
  };
}

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AdminUsersContent />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listAdminUsers).mockReset();
});

describe("AdminUsersContent", () => {
  it("renders real user data from the admin API, never a password field", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [fakeUser()], total: 1, totalPages: 1, page: 1 });

    const { container } = renderContent();

    expect(await screen.findByText("Aidos Testov")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/password/i);
  });

  it("re-queries with the typed search term", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [fakeUser()], total: 1, totalPages: 1, page: 1 });
    renderContent();

    await waitFor(() => expect(listAdminUsers).toHaveBeenCalledWith("admin-token", { search: undefined, page: 1 }));

    fireEvent.change(screen.getByLabelText(/поиск/i), { target: { value: "+7701" } });

    await waitFor(() =>
      expect(listAdminUsers).toHaveBeenCalledWith("admin-token", { search: "+7701", page: 1 }),
    );
  });

  it("shows an empty state when no user matches", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({ items: [], total: 0, totalPages: 1, page: 1 });
    renderContent();
    expect(await screen.findByText(/не найдены/i)).toBeTruthy();
  });

  it("shows an error state when the API call fails", async () => {
    vi.mocked(listAdminUsers).mockRejectedValue(new Error("network error"));
    renderContent();
    expect(await screen.findByText(/попробуйте/i)).toBeTruthy();
  });
});
