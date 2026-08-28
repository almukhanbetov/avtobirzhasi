import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { login } from "@/lib/api/auth";
import type { AuthUser } from "@/types/user";
import { LoginForm } from "./LoginForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/api/auth", () => ({ login: vi.fn() }));

const setSession = vi.fn();
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ login: setSession, status: "unauthenticated", user: null, token: null, logout: vi.fn() }),
}));

function user(role: "user" | "admin"): AuthUser {
  return {
    id: "u1",
    name: role === "admin" ? "Admin" : "Aidos",
    phone: "+77071234567",
    accountType: "private",
    role,
    rating: 5,
    reviewsCount: 0,
    since: "с 2026 года",
  };
}

function submitLogin() {
  render(
    <LanguageProvider>
      <LoginForm />
    </LanguageProvider>,
  );
  fireEvent.input(screen.getByLabelText("Телефон"), {
    target: { value: "87071234567" },
  });
  fireEvent.input(screen.getByLabelText("Пароль"), {
    target: { value: "secret123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
}

beforeEach(() => {
  replace.mockReset();
  setSession.mockReset();
  vi.mocked(login).mockReset();
});

describe("LoginForm post-login redirect", () => {
  it("sends a normal user to /dashboard", async () => {
    vi.mocked(login).mockResolvedValue({ token: "t", user: user("user") });
    submitLogin();
    await waitFor(() => expect(setSession).toHaveBeenCalledWith("t", user("user")));
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(replace).not.toHaveBeenCalledWith("/admin");
  });

  it("sends an admin to /admin (by role, not by the name 'Admin')", async () => {
    vi.mocked(login).mockResolvedValue({ token: "t", user: user("admin") });
    submitLogin();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(replace).not.toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect when login fails", async () => {
    vi.mocked(login).mockRejectedValue(new Error("bad creds"));
    submitLogin();
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });
});
