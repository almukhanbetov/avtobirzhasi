import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { AuthUser } from "@/types/user";
import { AuthStatus } from "./AuthStatus";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

let authState: {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
};
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ ...authState, logout: vi.fn() }),
}));

const admin: AuthUser = {
  id: "a1", name: "Admin", phone: "+77077801011", accountType: "private",
  role: "admin", rating: 5, reviewsCount: 0, since: "с 2026 года",
};
const normal: AuthUser = { ...admin, id: "u1", name: "Aidos", role: "user" };

function renderStatus() {
  return render(
    <LanguageProvider>
      <AuthStatus />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  authState = { status: "unauthenticated", user: null };
});

describe("AuthStatus admin-panel link", () => {
  it("shows an 'Админ-панель' link to /admin for an admin", () => {
    authState = { status: "authenticated", user: admin };
    renderStatus();
    fireEvent.click(screen.getByRole("button", { name: /Admin/ }));
    const link = screen.getByRole("link", { name: "Админ-панель" });
    expect(link.getAttribute("href")).toBe("/admin");
  });

  it("does NOT show the admin link for a normal user", () => {
    authState = { status: "authenticated", user: normal };
    renderStatus();
    fireEvent.click(screen.getByRole("button", { name: /Aidos/ }));
    expect(screen.queryByRole("link", { name: "Админ-панель" })).toBeNull();
    // ...but the normal dashboard link is still there
    expect(screen.getByRole("link", { name: "Личный кабинет" }).getAttribute("href")).toBe(
      "/dashboard",
    );
  });
});
