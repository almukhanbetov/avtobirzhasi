import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listCars } from "@/lib/api/cars";
import type { Car } from "@/types/car";
import { FreshListings } from "./FreshListings";

vi.mock("@/lib/api/cars", () => ({
  listCars: vi.fn(),
}));

// CarCard renders a FavoriteButton, which needs a mounted Next.js router
// and an auth session — neither exists in this unit test. Mocking as
// "logged out" is enough: useFavorites' own query is disabled unless
// authenticated, so no favorites API call happens either.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ status: "unauthenticated", token: null, user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeCar(id: string): Car {
  return {
    id,
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
    imageUrl: "https://example.com/car.jpg",
    images: ["https://example.com/car.jpg"],
    sellerId: "seller-1",
  };
}

function renderFreshListings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <FreshListings />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("FreshListings", () => {
  it("calls the real catalog API with sort=newest, page=1 — not mock data", async () => {
    vi.mocked(listCars).mockResolvedValue({ items: [fakeCar("car-1")], total: 1, totalPages: 1, page: 1 });

    renderFreshListings();

    await waitFor(() => expect(listCars).toHaveBeenCalledTimes(1));
    const filters = vi.mocked(listCars).mock.calls[0][0];
    expect(filters.sort).toBe("newest");
    expect(filters.page).toBe(1);
  });

  it("renders a card linking to the real /cars/[id] page for each returned listing", async () => {
    vi.mocked(listCars).mockResolvedValue({
      items: [fakeCar("car-1"), fakeCar("car-2")],
      total: 2,
      totalPages: 1,
      page: 1,
    });

    renderFreshListings();

    const links = await screen.findAllByRole("link", { name: /toyota camry/i });
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.getAttribute("href")).sort()).toEqual(["/cars/car-1", "/cars/car-2"]);
  });

  it("renders nothing once loaded if the catalog has no active listings", async () => {
    vi.mocked(listCars).mockResolvedValue({ items: [], total: 0, totalPages: 1, page: 1 });

    const { container } = renderFreshListings();

    await waitFor(() => expect(listCars).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("shows an error message instead of crashing when the API call fails", async () => {
    vi.mocked(listCars).mockRejectedValue(new Error("network error"));

    renderFreshListings();

    await waitFor(() => expect(screen.queryByText(/попробуйте/i)).not.toBeNull());
  });
});
