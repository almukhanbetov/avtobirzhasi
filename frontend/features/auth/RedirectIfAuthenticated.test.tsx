import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { AuthUser } from "@/types/user";
import { RedirectIfAuthenticated } from "./RedirectIfAuthenticated";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

let authState: {
  status: "loading" | "authenticated" | "unauthenticated";
  user: AuthUser | null;
};
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => authState,
}));

const admin: AuthUser = {
  id: "a1", name: "Admin", phone: "+77077801011", accountType: "private",
  role: "admin", rating: 5, reviewsCount: 0, since: "с 2026 года",
};
const normal: AuthUser = { ...admin, id: "u1", name: "Aidos", role: "user" };

beforeEach(() => {
  replace.mockReset();
  authState = { status: "loading", user: null };
});

describe("RedirectIfAuthenticated (on /login)", () => {
  it("does nothing while the session is loading", () => {
    authState = { status: "loading", user: null };
    render(<RedirectIfAuthenticated />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing for a guest", () => {
    authState = { status: "unauthenticated", user: null };
    render(<RedirectIfAuthenticated />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends an already-authenticated normal user to /dashboard", async () => {
    authState = { status: "authenticated", user: normal };
    render(<RedirectIfAuthenticated />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends an already-authenticated admin to /admin", async () => {
    authState = { status: "authenticated", user: admin };
    render(<RedirectIfAuthenticated />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });
});
