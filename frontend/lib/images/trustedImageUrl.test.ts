import { describe, expect, it } from "vitest";
import { isTrustedImageUrl } from "./trustedImageUrl";

// Stage 8Б-4: mirrors next.config.js's images.remotePatterns exactly —
// a mismatch here (in either direction) is exactly how the reported
// "Invalid src prop ... hostname is not configured" runtime error slips
// through un-caught by CarCard's fallback.

describe("isTrustedImageUrl", () => {
  it("trusts an Unsplash photo URL", () => {
    expect(isTrustedImageUrl("https://images.unsplash.com/photo-123?auto=format")).toBe(true);
  });

  it("trusts a local backend upload URL on :8080", () => {
    expect(isTrustedImageUrl("http://localhost:8080/uploads/abc.jpg")).toBe(true);
  });

  it("trusts a production api.avtobirzhasi.kz upload URL", () => {
    expect(isTrustedImageUrl("https://api.avtobirzhasi.kz/uploads/abc.jpg")).toBe(true);
  });

  it("rejects a fictional/placeholder domain like example.com", () => {
    expect(isTrustedImageUrl("https://example.com/s5.jpg")).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isTrustedImageUrl("not-a-url")).toBe(false);
  });

  it("rejects null, undefined and an empty string", () => {
    expect(isTrustedImageUrl(null)).toBe(false);
    expect(isTrustedImageUrl(undefined)).toBe(false);
    expect(isTrustedImageUrl("")).toBe(false);
  });

  it("rejects localhost on the wrong port", () => {
    expect(isTrustedImageUrl("http://localhost:3000/uploads/abc.jpg")).toBe(false);
  });

  it("rejects a path outside /uploads/ even on a trusted host", () => {
    expect(isTrustedImageUrl("http://localhost:8080/other/abc.jpg")).toBe(false);
  });

  it("rejects Unsplash over plain http (protocol must match)", () => {
    expect(isTrustedImageUrl("http://images.unsplash.com/photo-123")).toBe(false);
  });
});
