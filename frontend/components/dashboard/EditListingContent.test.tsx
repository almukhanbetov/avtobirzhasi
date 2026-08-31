import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listMyListings, updateListing } from "@/lib/api/listings";
import type { SellerListing } from "@/types/dashboard";
import { EditListingContent } from "./EditListingContent";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

vi.mock("@/lib/api/listings", () => ({
  listMyListings: vi.fn(),
  updateListing: vi.fn(),
  createListing: vi.fn(),
}));
vi.mock("@/lib/api/uploads", async (o) => {
  const actual = await o<typeof import("@/lib/api/uploads")>();
  return { ...actual, uploadListingImages: vi.fn() };
});
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "tok", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function listing(overrides: Partial<SellerListing["car"]> = {}): SellerListing {
  return {
    id: "listing-9",
    status: "active",
    updatedAt: new Date().toISOString(),
    car: {
      id: "car-9", make: "Toyota", model: "Camry", year: 2019, price: 7_000_000,
      mileageKm: 55_000, region: "Алматы", transmission: "automatic", fuelType: "petrol",
      bodyType: "sedan", drivetrain: "fwd", engineVolume: 2.5, enginePower: 181,
      color: "белый", steeringWheel: "left",
      imageUrl: "https://x/a.jpg", images: ["https://x/a.jpg", "https://x/b.jpg"],
      sellerId: "s1", isExchange: false, description: "старое описание",
      ...overrides,
    },
  };
}

function renderEdit(id = "listing-9") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <EditListingContent listingId={id} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  vi.mocked(listMyListings).mockReset();
  vi.mocked(updateListing).mockReset();
});

describe("EditListingContent", () => {
  it("opens the edit form prefilled with the listing's current values", async () => {
    vi.mocked(listMyListings).mockResolvedValue([listing()]);
    renderEdit();

    expect(await screen.findByText("Редактировать объявление")).toBeTruthy();
    expect((screen.getByLabelText("Модель") as HTMLInputElement).value).toBe("Camry");
    expect((screen.getByLabelText("Год выпуска") as HTMLInputElement).value).toBe("2019");
    expect((screen.getByLabelText("Цена, ₸") as HTMLInputElement).value).toBe("7000000");
    expect((screen.getByLabelText("Описание (необязательно)") as HTMLTextAreaElement).value).toBe(
      "старое описание",
    );
  });

  it("renders the listing's existing photos", async () => {
    vi.mocked(listMyListings).mockResolvedValue([listing()]);
    renderEdit();
    await screen.findByText("Редактировать объявление");

    expect(document.querySelector('img[src="https://x/a.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src="https://x/b.jpg"]')).toBeTruthy();
  });

  it("submits changed data through updateListing and returns to the list", async () => {
    vi.mocked(listMyListings).mockResolvedValue([listing()]);
    vi.mocked(updateListing).mockResolvedValue({} as never);
    renderEdit();
    await screen.findByText("Редактировать объявление");

    fireEvent.change(screen.getByLabelText("Цена, ₸"), { target: { value: "6500000" } });
    fireEvent.click(screen.getByRole("button", { name: /сохранить изменения/i }));

    await waitFor(() =>
      expect(updateListing).toHaveBeenCalledWith(
        "tok",
        "listing-9",
        expect.objectContaining({
          price: 6_500_000,
          model: "Camry",
          images: ["https://x/a.jpg", "https://x/b.jpg"],
        }),
      ),
    );
    expect(await screen.findByText("Изменения сохранены")).toBeTruthy();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/listings"));
  });

  it("never sends price for an exchange-managed listing", async () => {
    vi.mocked(listMyListings).mockResolvedValue([listing({ isExchange: true })]);
    vi.mocked(updateListing).mockResolvedValue({} as never);
    renderEdit();
    await screen.findByText("Редактировать объявление");

    fireEvent.click(screen.getByRole("button", { name: /сохранить изменения/i }));

    await waitFor(() => expect(updateListing).toHaveBeenCalled());
    expect(vi.mocked(updateListing).mock.calls[0][2]).not.toHaveProperty("price");
  });

  it("shows a not-found fallback for a listing that isn't the user's", async () => {
    vi.mocked(listMyListings).mockResolvedValue([listing()]);
    renderEdit("someone-elses-id");

    expect(await screen.findByText(/пока нет объявлений/i)).toBeTruthy();
    expect(screen.queryByText("Редактировать объявление")).toBeNull();
  });
});
