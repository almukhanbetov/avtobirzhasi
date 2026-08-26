import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

// Mirrors backend/internal/service/phone_test.go — the backend
// re-validates with the identical rule (see SKILL.md's Auth section), so
// both sides must agree on exactly these four accepted shapes.
describe("loginSchema phone normalization", () => {
  const validPassword = "password123";

  it.each([
    ["8-prefixed", "87071234567"],
    ["7-prefixed", "77071234567"],
    ["bare 10 digits", "7071234567"],
    ["already normalized", "+77071234567"],
    ["formatted with spaces and dashes", "8 707 123-45-67"],
  ])("accepts %s and normalizes to +77071234567", (_label, phone) => {
    const result = loginSchema.safeParse({ phone, password: validPassword });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+77071234567");
    }
  });

  it("rejects a phone that doesn't resolve to a valid KZ number", () => {
    const result = loginSchema.safeParse({ phone: "123", password: validPassword });
    expect(result.success).toBe(false);
  });

  it("rejects a password under 6 characters", () => {
    const result = loginSchema.safeParse({ phone: "87071234567", password: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    name: "Aidos",
    phone: "87071234567",
    password: "password123",
  };

  it("accepts matching passwords", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "password123" });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords with an error on confirmPassword", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });
});
