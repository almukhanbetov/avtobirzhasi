import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getAdminListing, updateAdminListing } from "@/lib/api/admin";
import type { AdminListing } from "@/types/admin";
import { AdminEditListingContent } from "./AdminEditListingContent";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

vi.mock("@/lib/api/admin", () => ({
  getAdminListing: vi.fn(),
  updateAdminListing: vi.fn(),
}));
vi.mock("@/lib/api/uploads", async (o) => {
  const actual = await o<typeof import("@/lib/api/uploads")>();
  return { ...actual, uploadListingImages: vi.fn() };
});
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "admin-tok", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

function listing(overrides: Partial<AdminListing["car"]> = {}): AdminListing {
  return {
    id: "listing-42",
    status: "active",
    updatedAt: new Date().toISOString(),
    sellerName: "Ivan Seller",
    car: {
      id: "car-42", make: "Toyota", model: "Camry", year: 2019, price: 7_000_000,
      mileageKm: 55_000, region: "Алматы", transmission: "automatic", fuelType: "petrol",
      bodyType: "sedan", drivetrain: "fwd", engineVolume: 2.5, enginePower: 181,
      color: "белый", steeringWheel: "left",
      imageUrl: "https://x/a.jpg", images: ["https://x/a.jpg", "https://x/b.jpg"],
      sellerId: "s1", isExchange: false, description: "старое описание",
      ...overrides,
    },
  };
}

function renderEdit(id = "listing-42") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <AdminEditListingContent listingId={id} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(getAdminListing).mockReset();
  vi.mocked(updateAdminListing).mockReset();
});

describe("AdminEditListingContent", () => {
  it("prefills the shared form and shows the listing's existing photos", async () => {
    vi.mocked(getAdminListing).mockResolvedValue(listing());
    renderEdit();

    expect(await screen.findByText("Редактировать объявление")).toBeTruthy();
    expect((screen.getByLabelText("Модель") as HTMLInputElement).value).toBe("Camry");
    expect((screen.getByLabelText("Цена, ₸") as HTMLInputElement).value).toBe("7000000");
    expect(document.querySelector('img[src="https://x/a.jpg"]')).toBeTruthy();
    expect(document.querySelector('img[src="https://x/b.jpg"]')).toBeTruthy();
  });

  it("saves through updateAdminListing and returns to the admin list", async () => {
    vi.mocked(getAdminListing).mockResolvedValue(listing());
    vi.mocked(updateAdminListing).mockResolvedValue({} as never);
    renderEdit();
    await screen.findByText("Редактировать объявление");

    fireEvent.change(screen.getByLabelText("Цена, ₸"), { target: { value: "6400000" } });
    fireEvent.click(screen.getByRole("button", { name: /сохранить изменения/i }));

    await waitFor(() =>
      expect(updateAdminListing).toHaveBeenCalledWith(
        "admin-tok",
        "listing-42",
        expect.objectContaining({
          price: 6_400_000,
          model: "Camry",
          images: ["https://x/a.jpg", "https://x/b.jpg"],
        }),
      ),
    );
    expect(await screen.findByText("Изменения сохранены")).toBeTruthy();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/listings"));
  });

  it("never sends price for an exchange-managed listing", async () => {
    vi.mocked(getAdminListing).mockResolvedValue(listing({ isExchange: true }));
    vi.mocked(updateAdminListing).mockResolvedValue({} as never);
    renderEdit();
    await screen.findByText("Редактировать объявление");

    fireEvent.click(screen.getByRole("button", { name: /сохранить изменения/i }));

    await waitFor(() => expect(updateAdminListing).toHaveBeenCalled());
    expect(vi.mocked(updateAdminListing).mock.calls[0][2]).not.toHaveProperty("price");
  });

  it("shows an error fallback when the listing can't be loaded", async () => {
    vi.mocked(getAdminListing).mockRejectedValue(new Error("nope"));
    renderEdit();

    expect(await screen.findByText(/не удалось загрузить/i)).toBeTruthy();
    expect(screen.queryByText("Редактировать объявление")).toBeNull();
  });
});
