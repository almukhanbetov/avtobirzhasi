import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { Car } from "@/types/car";
import { CarCard } from "./CarCard";

// Stage 8Б-4: reproduces the reported Runtime Error ("Invalid src prop
// ... hostname is not configured under images in next.config.js") — a
// handful of pre-existing local dev listings carry leftover
// https://example.com/*.jpg placeholder photos from manual/E2E testing
// that predates this feature. CarCard must fall back safely for those
// (and for missing/malformed URLs) instead of crashing, while still
// rendering a real trusted photo normally.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
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
    imageUrl: "https://images.unsplash.com/photo-123?auto=format",
    images: ["https://images.unsplash.com/photo-123?auto=format"],
    sellerId: "seller-1",
    ...overrides,
  };
}

function renderCard(car: Car) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <CarCard car={car} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("CarCard — image trust fallback (Stage 8Б-4)", () => {
  it("renders a real trusted (Unsplash) photo as an <img>", () => {
    renderCard(fakeCar());

    const img = screen.getByRole("img", { name: /toyota camry/i });
    expect(img).toBeTruthy();
    // next/image rewrites src through its optimizer — the trusted host
    // must appear somewhere in the resulting URL either way.
    expect(img.getAttribute("src")).toContain("images.unsplash.com");
  });

  it("falls back to a placeholder, not a crash, for a fictional example.com URL", () => {
    renderCard(
      fakeCar({ imageUrl: "https://example.com/s5.jpg", images: ["https://example.com/s5.jpg"] }),
    );

    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();
    expect(screen.getByText("Toyota Camry")).toBeTruthy();
  });

  it("falls back to a placeholder when imageUrl is empty (no photo)", () => {
    renderCard(fakeCar({ imageUrl: "", images: [] }));

    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();
  });

  it("falls back to a placeholder for a malformed URL", () => {
    renderCard(fakeCar({ imageUrl: "not-a-url" }));

    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();
  });

  it("renders the trusted photo even when the listing has several images", () => {
    renderCard(
      fakeCar({
        imageUrl: "https://images.unsplash.com/photo-123?auto=format",
        images: [
          "https://images.unsplash.com/photo-123?auto=format",
          "https://images.unsplash.com/photo-456?auto=format",
          "https://images.unsplash.com/photo-789?auto=format",
        ],
      }),
    );

    const img = screen.getByRole("img", { name: /toyota camry/i });
    expect(img.getAttribute("src")).toContain("images.unsplash.com");
  });
});

describe("CarCard — falls back when a trusted URL still fails to load (Stage 8В-1)", () => {
  it("reproduces the reported /cars bug: a real listing's uploads URL, right host but wrong port for this environment, 404s and shows the placeholder instead of a broken-image icon", () => {
    // Same shape as the real listing found in the local dev DB — host is
    // on next.config.js's allowlist (isTrustedImageUrl says yes), but
    // nothing on this port actually serves the file in this environment.
    renderCard(fakeCar({ imageUrl: "http://localhost:8080/uploads/40907ff0b1b5e873a9f809c36f55e453.jpg" }));

    const img = screen.getByRole("img", { name: /toyota camry/i });
    fireEvent.error(img);

    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();
    expect(screen.getByText("Toyota Camry")).toBeTruthy();
  });

  it("keeps showing the photo normally when it loads without error", () => {
    renderCard(fakeCar());

    // No error event fired — the trusted, successfully-loading case from
    // the tests above must be unaffected by the new onError wiring.
    expect(screen.getByRole("img", { name: /toyota camry/i })).toBeTruthy();
  });
});

describe("CarCard — the placeholder clears once the resolved URL changes (Step 4)", () => {
  it("retries a genuinely different src after an earlier one failed, instead of being stuck on the placeholder forever", () => {
    // Reproduces the Step 4 report verbatim: a fix (e.g. resolveImageUrl
    // now producing a correct URL, Step 2) landed for the SAME CarCard
    // instance — same as a dev Fast Refresh preserving hook state across
    // an edit, or the underlying `car` prop simply being refetched with
    // a repaired imageUrl — without a full unmount/remount. Before this
    // fix, a bare boolean "did loading fail" never cleared once set, so
    // the placeholder stuck around even once the new src was genuinely
    // loadable.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <CarCard car={fakeCar({ imageUrl: "https://images.unsplash.com/photo-stale" })} />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    fireEvent.error(screen.getByRole("img", { name: /toyota camry/i }));
    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();

    rerender(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <CarCard car={fakeCar({ imageUrl: "https://images.unsplash.com/photo-repaired" })} />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    const img = screen.getByRole("img", { name: /toyota camry/i });
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toContain("photo-repaired");
  });

  it("keeps the placeholder if the exact same src fails again", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const car = fakeCar({ imageUrl: "https://images.unsplash.com/photo-broken" });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <CarCard car={car} />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    fireEvent.error(screen.getByRole("img", { name: /toyota camry/i }));
    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();

    // Same car object, e.g. a re-render triggered by something unrelated
    // (favorites toggling, a parent list re-render) — must not spuriously
    // "un-fail" and try loading the same known-broken URL again.
    rerender(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <CarCard car={car} />
        </LanguageProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("img", { name: /toyota camry/i })).toBeNull();
  });
});
