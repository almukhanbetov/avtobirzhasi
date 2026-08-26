import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { archiveListing, updateListing } from "@/lib/api/listings";
import type { SellerListing } from "@/types/dashboard";
import { ListingRow } from "./ListingRow";

vi.mock("@/lib/api/listings", () => ({
  archiveListing: vi.fn(),
  updateListing: vi.fn(),
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "test-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function fakeListing(overrides: Partial<SellerListing["car"]> = {}): SellerListing {
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
      ...overrides,
    },
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

beforeEach(() => {
  vi.mocked(archiveListing).mockReset();
  vi.mocked(updateListing).mockReset();
});

describe("ListingRow delete", () => {
  it("does not call the API when the confirmation dialog is dismissed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderRow(fakeListing());

    fireEvent.click(screen.getByRole("button", { name: /удалить/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(archiveListing).not.toHaveBeenCalled();
  });

  it("archives the listing once the confirmation dialog is accepted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(archiveListing).mockResolvedValue(undefined);
    renderRow(fakeListing());

    fireEvent.click(screen.getByRole("button", { name: /удалить/i }));

    await waitFor(() => expect(archiveListing).toHaveBeenCalledWith("test-token", "listing-1"));
  });
});

describe("ListingRow edit", () => {
  it("submits the edited fields with the real API shape", async () => {
    vi.mocked(updateListing).mockResolvedValue({} as never);
    renderRow(fakeListing());

    fireEvent.click(screen.getByRole("button", { name: /изменить/i }));
    fireEvent.change(screen.getByLabelText(/пробег/i), { target: { value: "45000" } });
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() =>
      expect(updateListing).toHaveBeenCalledWith(
        "test-token",
        "listing-1",
        expect.objectContaining({ price: 5_000_000, mileageKm: 45_000, region: "Алматы", color: "white" }),
      ),
    );
  });

  it("never sends price for an exchange-managed listing — Stage 2's server-side block has a matching client-side guard", async () => {
    vi.mocked(updateListing).mockResolvedValue({} as never);
    renderRow(fakeListing({ isExchange: true }));

    fireEvent.click(screen.getByRole("button", { name: /изменить/i }));
    fireEvent.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => expect(updateListing).toHaveBeenCalled());
    const payload = vi.mocked(updateListing).mock.calls[0][2];
    expect(payload).not.toHaveProperty("price");
  });
});
