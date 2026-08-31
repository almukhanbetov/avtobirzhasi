import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { archiveListing } from "@/lib/api/listings";
import type { SellerListing } from "@/types/dashboard";
import { ListingRow } from "./ListingRow";

vi.mock("@/lib/api/listings", () => ({ archiveListing: vi.fn() }));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "test-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeListing(overrides: Partial<SellerListing> = {}): SellerListing {
  return {
    id: "listing-1",
    status: "active",
    updatedAt: new Date().toISOString(),
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
      isExchange: false,
    },
    ...overrides,
  };
}

function renderRow(listing: SellerListing) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ListingRow listing={listing} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /действия/i }));
}

beforeEach(() => {
  vi.mocked(archiveListing).mockReset();
});

describe("ListingRow action menu", () => {
  it("the owner sees a ⋮ actions menu with Edit + Delete", () => {
    renderRow(fakeListing());
    openMenu();

    const edit = screen.getByRole("menuitem", { name: /редактировать/i });
    expect(edit.getAttribute("href")).toBe("/dashboard/listings/listing-1/edit");
    expect(screen.getByRole("menuitem", { name: /удалить/i })).toBeTruthy();
  });

  it("keeps the 'Открыть' link to the public listing page", () => {
    renderRow(fakeListing());
    expect(screen.getByRole("link", { name: /открыть/i }).getAttribute("href")).toBe("/cars/car-1");
  });

  it("does not archive when the confirm dialog is dismissed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderRow(fakeListing());
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /удалить/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(archiveListing).not.toHaveBeenCalled();
  });

  it("archives once the confirm dialog is accepted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(archiveListing).mockResolvedValue(undefined);
    renderRow(fakeListing());
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /удалить/i }));

    await waitFor(() => expect(archiveListing).toHaveBeenCalledWith("test-token", "listing-1"));
  });

  it("disables the menu for a listing that is no longer the owner's to change", () => {
    renderRow(fakeListing({ status: "frozen" }));
    expect(
      (screen.getByRole("button", { name: /действия/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
