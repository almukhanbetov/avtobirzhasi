import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Car } from "@/types/car";

// Step 2 — end-to-end regression for the exact real-world case found on
// /cars (Toyota Camry, Almaty): a listing's stored photo URL has the
// local backend's *old* port baked in (:8080), but this environment's
// backend actually runs on :8081 (NEXT_PUBLIC_API_URL). Before this
// fix, CarCard fell back to the placeholder (Stage 8В-1's onError
// safety net) because the request to :8080 genuinely 404s. Now the URL
// is rewritten to :8081 before it's ever requested, so the real photo
// loads instead of needing the fallback at all.
//
// NEXT_PUBLIC_API_URL is read once at module import by trustedImageUrl.ts
// — vi.resetModules() + a dynamic import gets a CarCard that sees the
// stubbed value, same technique as lib/images/resolveImageUrl.test.ts.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ status: "unauthenticated", token: null, user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeCar(overrides: Partial<Car> = {}): Car {
  return {
    id: "car-1",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    price: 10_000_000,
    mileageKm: 50_000,
    region: "Алматы",
    transmission: "automatic",
    fuelType: "petrol",
    bodyType: "sedan",
    drivetrain: "fwd",
    engineVolume: 2.5,
    enginePower: 180,
    color: "white",
    steeringWheel: "left",
    imageUrl: "http://localhost:8080/uploads/40907ff0b1b5e873a9f809c36f55e453.jpg",
    images: ["http://localhost:8080/uploads/40907ff0b1b5e873a9f809c36f55e453.jpg"],
    sellerId: "seller-1",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CarCard — real photo restored when the backend's port has changed (Step 2)", () => {
  it("renders the real photo, rewritten to the configured origin, instead of the placeholder", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8081/api");
    vi.resetModules();
    // Everything that carries React context identity must come from the
    // same post-reset module graph as CarCard, or providers mounted from
    // a stale (pre-reset) import won't satisfy hooks in the fresh one.
    const { CarCard } = await import("./CarCard");
    const { LanguageProvider } = await import("@/lib/i18n/LanguageProvider");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <CarCard car={fakeCar()} />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    const img = screen.getByRole("img", { name: /toyota camry/i });
    expect(img.getAttribute("src")).toContain("8081");
    expect(img.getAttribute("src")).not.toContain("8080");
  });
});
