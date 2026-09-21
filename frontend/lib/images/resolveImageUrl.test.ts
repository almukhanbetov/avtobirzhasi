import { afterEach, describe, expect, it, vi } from "vitest";

// Step 2 — "Восстановление настоящих фотографий": a listing photo
// uploaded while the local backend ran on one port (:8080, config.go's
// default) still has that port baked into its stored URL even after the
// backend later starts on a different one (:8081, this sandbox's actual
// port — see docs/LOCATION_QA_REPORT.md). resolveImageUrl repairs only
// that specific mismatch, deriving the correct port from
// NEXT_PUBLIC_API_URL (never a hardcoded "8081") rather than the DB
// record, which is never touched.
//
// NEXT_PUBLIC_API_URL is read once, at module import, by the other
// module-level values trustedImageUrl.ts derives from it — so each test
// here stubs the env var and re-imports the module fresh via
// vi.resetModules(), rather than relying on any caching across tests.

async function freshModule() {
  vi.resetModules();
  return import("./trustedImageUrl");
}

describe("resolveImageUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites a stale localhost:8080 /uploads/ URL to the currently configured origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    const { resolveImageUrl } = await freshModule();

    expect(resolveImageUrl("http://localhost:8080/uploads/40907ff0b1b5e873a9f809c36f55e453.jpg")).toBe(
      "http://localhost:8081/uploads/40907ff0b1b5e873a9f809c36f55e453.jpg",
    );
  });

  it("leaves an /uploads/ URL unchanged when it already matches the configured origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    const { resolveImageUrl } = await freshModule();

    const url = "http://localhost:8081/uploads/abc.jpg";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("never touches an Unsplash URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    const { resolveImageUrl } = await freshModule();

    const url = "https://images.unsplash.com/photo-123?auto=format";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("never touches the production api.avtobirzhasi.kz host", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    const { resolveImageUrl } = await freshModule();

    const url = "https://api.avtobirzhasi.kz/uploads/abc.jpg";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("does nothing when NEXT_PUBLIC_API_URL isn't set (unchanged default behavior)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const { resolveImageUrl } = await freshModule();

    const url = "http://localhost:8080/uploads/abc.jpg";
    expect(resolveImageUrl(url)).toBe(url);
  });

  it("passes null/empty through unchanged", async () => {
    const { resolveImageUrl } = await freshModule();
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl("")).toBeNull();
  });

  it("isTrustedImageUrl's local pattern follows the same derived port, so a resolved URL is then trusted", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    const { resolveImageUrl, isTrustedImageUrl } = await freshModule();

    const resolved = resolveImageUrl("http://localhost:8080/uploads/abc.jpg");
    expect(isTrustedImageUrl(resolved)).toBe(true);
    // The stale, un-resolved original is on the wrong port for this
    // environment and must not itself be treated as trusted.
    expect(isTrustedImageUrl("http://localhost:8080/uploads/abc.jpg")).toBe(false);
  });
});
