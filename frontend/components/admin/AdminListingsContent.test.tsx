import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { archiveAdminListing, listAdminListings } from "@/lib/api/admin";
import type { AdminListing } from "@/types/admin";
import { AdminListingsContent } from "./AdminListingsContent";

vi.mock("@/lib/api/admin", () => ({
  listAdminListings: vi.fn(),
  archiveAdminListing: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "admin-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeListing(overrides: Partial<AdminListing> = {}): AdminListing {
  return {
    id: "listing-1",
    status: "active",
    updatedAt: new Date().toISOString(),
    sellerName: "Ivan Seller",
    car: {
      id: "car-1",
      make: "Toyota",
      model: "Camry",
      year: 2020,
      price: 5_000_000,
      mileageKm: 40_000,
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
    },
    ...overrides,
  };
}

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AdminListingsContent />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(listAdminListings).mockReset();
  vi.mocked(archiveAdminListing).mockReset();
});

describe("AdminListingsContent", () => {
  it("shows real data from the admin API, not mock data", async () => {
    vi.mocked(listAdminListings).mockResolvedValue({
      items: [fakeListing()],
      total: 1,
      totalPages: 1,
      page: 1,
    });

    renderContent();

    await waitFor(() => expect(listAdminListings).toHaveBeenCalledWith("admin-token", { status: undefined, page: 1 }));
    expect(await screen.findByText(/Ivan Seller/)).toBeTruthy();
  });

  it("shows a loading skeleton before data arrives", () => {
    vi.mocked(listAdminListings).mockReturnValue(new Promise(() => {}));
    const { container } = renderContent();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no listings", async () => {
    vi.mocked(listAdminListings).mockResolvedValue({ items: [], total: 0, totalPages: 1, page: 1 });
    renderContent();
    expect(await screen.findByText(/не найдено/i)).toBeTruthy();
  });

  it("shows an error state when the API call fails", async () => {
    vi.mocked(listAdminListings).mockRejectedValue(new Error("network error"));
    renderContent();
    expect(await screen.findByText(/попробуйте/i)).toBeTruthy();
  });

  it("archives a listing only after the confirmation dialog is accepted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(listAdminListings).mockResolvedValue({
      items: [fakeListing()],
      total: 1,
      totalPages: 1,
      page: 1,
    });
    vi.mocked(archiveAdminListing).mockResolvedValue(undefined);

    renderContent();

    const archiveButton = await screen.findByRole("button", { name: /удалить/i });
    fireEvent.click(archiveButton);

    await waitFor(() => expect(archiveAdminListing).toHaveBeenCalledWith("admin-token", "listing-1"));
  });

  it("does not archive when the confirmation dialog is dismissed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(listAdminListings).mockResolvedValue({
      items: [fakeListing()],
      total: 1,
      totalPages: 1,
      page: 1,
    });

    renderContent();

    const archiveButton = await screen.findByRole("button", { name: /удалить/i });
    fireEvent.click(archiveButton);

    expect(archiveAdminListing).not.toHaveBeenCalled();
  });
});
