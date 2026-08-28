import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { AuthUser } from "@/types/user";
import { RequireAdmin } from "./RequireAdmin";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin",
}));

let authState: {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
};
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ ...authState, token: null, login: vi.fn(), logout: vi.fn() }),
}));

function renderGuard() {
  return render(
    <LanguageProvider>
      <RequireAdmin>
        <div data-testid="admin-panel">ADMIN DASHBOARD</div>
      </RequireAdmin>
    </LanguageProvider>,
  );
}

const adminUser: AuthUser = {
  id: "u1",
  name: "Admin",
  phone: "+77077801011",
  accountType: "private",
  role: "admin",
  rating: 5,
  reviewsCount: 0,
  since: "с 2026 года",
};

beforeEach(() => {
  replace.mockReset();
  authState = { status: "loading", user: null };
});

describe("RequireAdmin", () => {
  it("shows a spinner while the session is still loading", () => {
    authState = { status: "loading", user: null };
    renderGuard();
    expect(screen.queryByTestId("admin-panel")).toBeNull();
    expect(screen.getByText("Загрузка…")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a guest to /login — never to the homepage", async () => {
    authState = { status: "unauthenticated", user: null };
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalledWith("/");
    expect(screen.queryByTestId("admin-panel")).toBeNull();
  });

  it("shows an explicit access-denied panel for a signed-in non-admin — never the homepage", async () => {
    authState = { status: "authenticated", user: { ...adminUser, role: "user" } };
    renderGuard();
    expect(await screen.findByText("Доступ запрещён")).toBeTruthy();
    expect(screen.queryByTestId("admin-panel")).toBeNull();
    // The old bug: router.replace("/") dumped non-admins on the marketing
    // homepage, which reads as "/admin doesn't exist".
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders the admin panel for an admin", () => {
    authState = { status: "authenticated", user: adminUser };
    renderGuard();
    expect(screen.getByTestId("admin-panel")).toBeTruthy();
    expect(screen.getByText("ADMIN DASHBOARD")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
