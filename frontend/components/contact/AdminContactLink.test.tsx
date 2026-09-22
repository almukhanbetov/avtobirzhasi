import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { ADMIN_CONTACT } from "@/lib/contact/adminContact";
import { AdminContactLink } from "./AdminContactLink";

// Единый номер администратора: this is the one shared component every
// "Показать номер"-equivalent surface uses, so its own correctness
// (number, tel: href, label) only needs proving once here — the
// per-page tests just confirm this component is actually rendered in
// the right place under the right condition.

function renderLink(variant?: "button" | "compact") {
  return render(
    <LanguageProvider>
      <AdminContactLink variant={variant} />
    </LanguageProvider>,
  );
}

describe("AdminContactLink", () => {
  it("shows the exact required admin number", () => {
    renderLink();
    expect(screen.getByText("+7 702 789 7120")).toBeTruthy();
    expect(ADMIN_CONTACT.displayPhone).toBe("+7 702 789 7120");
  });

  it("dials the exact required tel: target", () => {
    renderLink();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
    expect(ADMIN_CONTACT.telPhone).toBe("+77027897120");
  });

  it("shows the required 'Связаться с администратором' caption (button variant)", () => {
    renderLink("button");
    expect(screen.getByText("Связаться с администратором")).toBeTruthy();
  });

  it("compact variant is still a real, immediately clickable tel: link — no reveal step", () => {
    renderLink("compact");
    const link = screen.getByRole("link", { name: /702 789 7120/ });
    expect(link.getAttribute("href")).toBe("tel:+77027897120");
  });

  it("is a plain anchor, not a button requiring an extra click to reveal the number", () => {
    renderLink();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link").tagName).toBe("A");
  });
});
