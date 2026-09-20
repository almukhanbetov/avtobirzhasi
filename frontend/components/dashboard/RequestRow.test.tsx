import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { updateRequest, cancelRequest } from "@/lib/api/requests";
import { listRegions, listCitiesByRegion, listDistrictsByCity, resolveLegacyRegionText } from "@/lib/api/locations";
import type { BuyerRequest } from "@/types/dashboard";
import { RequestRow } from "./RequestRow";

// Stage 6Б: RequestRow's inline edit form now uses LocationSelector
// (unchanged since Stage 5А) instead of the old flat region <Select>.
// The cascade/reset/stale-request logic itself is already covered by
// features/location/LocationSelector.test.tsx and not re-tested here.

vi.mock("@/lib/api/requests", () => ({
  updateRequest: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
  resolveLegacyRegionText: vi.fn(),
}));
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "user-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
}));

const almatyRegion = {
  id: "r-almaty-obl",
  nameRu: "Алматинская область",
  nameKz: "Алматы облысы",
  kind: "oblast" as const,
  isSpecial: false,
};
const almatyCityRegion = {
  id: "r-almaty-city",
  nameRu: "город Алматы",
  nameKz: "Алматы қаласы",
  kind: "republican_city" as const,
  isSpecial: true,
};
const konaev = { id: "c-konaev", regionId: "r-almaty-obl", nameRu: "Конаев", nameKz: "Қонаев" };
const almatyTheCity = { id: "c-almaty", regionId: "r-almaty-city", nameRu: "Алматы", nameKz: "Алматы" };
const almalinsky = {
  id: "d-almaly",
  kind: "urban" as const,
  cityId: "c-konaev",
  nameRu: "Алмалинский район",
  nameKz: "Алмалы ауданы",
};

function fakeRequest(overrides: Partial<BuyerRequest> = {}): BuyerRequest {
  return {
    id: "request-1",
    make: "Toyota",
    model: "Camry",
    yearFrom: 2015,
    yearTo: 2020,
    region: "Алматы",
    currentOffer: 8_000_000,
    status: "active",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderRow(request: BuyerRequest) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <RequestRow request={request} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function openEdit() {
  fireEvent.click(screen.getByRole("button", { name: /изменить/i }));
}

beforeEach(() => {
  vi.mocked(updateRequest).mockReset();
  vi.mocked(updateRequest).mockResolvedValue({} as never);
  vi.mocked(cancelRequest).mockReset();
  vi.mocked(listRegions).mockReset();
  vi.mocked(listCitiesByRegion).mockReset();
  vi.mocked(listDistrictsByCity).mockReset();
  vi.mocked(resolveLegacyRegionText).mockReset();
  vi.mocked(resolveLegacyRegionText).mockResolvedValue(null);
  vi.mocked(listRegions).mockResolvedValue([almatyRegion, almatyCityRegion]);
  vi.mocked(listCitiesByRegion).mockImplementation(async (regionId: string) => {
    if (regionId === "r-almaty-obl") return [konaev];
    if (regionId === "r-almaty-city") return [almatyTheCity];
    return [];
  });
  vi.mocked(listDistrictsByCity).mockImplementation(async (cityId: string) => {
    if (cityId === "c-konaev") return [almalinsky];
    return [];
  });
});

describe("RequestRow edit — LocationSelector integration (Stage 6Б)", () => {
  it("restores the request's saved region, city and district once their data loads", async () => {
    renderRow(fakeRequest({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev", districtId: "d-almaly" }));
    openEdit();

    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));
    await waitFor(() => expect((screen.getByLabelText("Район") as HTMLSelectElement).value).toBe("d-almaly"));
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it("a legacy request (region text only) resolves and pre-fills without saving anything on open", async () => {
    vi.mocked(resolveLegacyRegionText).mockResolvedValue({ regionId: "r-almaty-obl", cityId: "c-konaev" });
    renderRow(fakeRequest({ region: "Конаев", regionId: undefined, cityId: undefined, districtId: undefined }));
    openEdit();

    await waitFor(() => expect(resolveLegacyRegionText).toHaveBeenCalledWith("Конаев"));
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));
    expect(updateRequest).not.toHaveBeenCalled();
  });

  it("Almaty (republican_city): the one city is auto-selected, never shown as a picker, and saving sends the ids", async () => {
    renderRow(fakeRequest({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev" }));
    openEdit();
    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
    expect(await screen.findByText(/Город: Алматы/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^сохранить$/i }));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        "user-token",
        "request-1",
        expect.objectContaining({ region: "Алматы", regionId: "r-almaty-city", cityId: "c-almaty" }),
      ),
    );
  });

  it("changing region resets the previously selected city", async () => {
    renderRow(fakeRequest({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev" }));
    openEdit();
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
  });

  it("cancelling the edit discards local location changes without saving", async () => {
    renderRow(fakeRequest({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev" }));
    openEdit();
    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });
    // Two buttons share the "Отмена" accessible name (the X icon and the
    // text button) — the text button is the later one in DOM order.
    const cancelButtons = screen.getAllByRole("button", { name: /отмена/i });
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(updateRequest).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Регион")).toBeNull(); // back to the read-only row
  });
});
