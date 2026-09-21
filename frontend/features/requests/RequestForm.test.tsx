import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { createRequest } from "@/lib/api/requests";
import { listRegions, listCitiesByRegion, listDistrictsByCity } from "@/lib/api/locations";
import { RequestForm } from "./RequestForm";

// Stage 6А: RequestForm's region <Select> is replaced by LocationSelector
// (Stage 5А, unchanged). This suite covers the integration points that
// are new here; the cascade/reset/stale-request logic itself is already
// covered by features/location/LocationSelector.test.tsx.

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

vi.mock("@/lib/api/requests", () => ({ createRequest: vi.fn() }));
vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
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

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <RequestForm />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function fillBaseFields() {
  fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
  fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });
  fireEvent.change(screen.getByLabelText("Год от"), { target: { value: "2015" } });
  fireEvent.change(screen.getByLabelText("Год до"), { target: { value: "2020" } });
  fireEvent.change(screen.getByLabelText("Стартовое предложение, ₸"), { target: { value: "8000000" } });
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createRequest).mockReset();
  vi.mocked(createRequest).mockResolvedValue({} as never);
  vi.mocked(listRegions).mockReset();
  vi.mocked(listCitiesByRegion).mockReset();
  vi.mocked(listDistrictsByCity).mockReset();
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

describe("RequestForm — LocationSelector integration", () => {
  it("submits region, city and district as UUIDs alongside the derived legacy region text", async () => {
    renderForm();
    fillBaseFields();
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });
    await screen.findByRole("option", { name: "Конаев" });
    fireEvent.change(screen.getByLabelText("Город"), { target: { value: "c-konaev" } });
    const districtSelect = await screen.findByLabelText("Район");
    fireEvent.change(districtSelect, { target: { value: "d-almaly" } });

    fireEvent.click(screen.getByRole("button", { name: /создать заявку/i }));

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({
          region: "Конаев",
          regionId: "r-almaty-obl",
          cityId: "c-konaev",
          districtId: "d-almaly",
          make: "Toyota",
          model: "Camry",
          yearFrom: 2015,
          yearTo: 2020,
          initialOffer: 8_000_000,
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/requests"));
  });

  it("a region with no city chosen is still a valid, submittable location", async () => {
    renderForm();
    fillBaseFields();
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });

    fireEvent.click(screen.getByRole("button", { name: /создать заявку/i }));

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({ region: "Алматинская область", regionId: "r-almaty-obl" }),
      ),
    );
    const payload = vi.mocked(createRequest).mock.calls[0][1];
    expect(payload.cityId).toBeUndefined();
  });

  it("Almaty (republican_city): the one city is auto-selected and never shown as a picker", async () => {
    renderForm();
    fillBaseFields();
    await screen.findByRole("option", { name: "город Алматы" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
    expect(await screen.findByText(/Город: Алматы/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /создать заявку/i }));

    await waitFor(() =>
      expect(createRequest).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({ region: "Алматы", regionId: "r-almaty-city", cityId: "c-almaty" }),
      ),
    );
  });

  it("changing region resets the previously selected city", async () => {
    renderForm();
    fillBaseFields();
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });
    await screen.findByRole("option", { name: "Конаев" });
    fireEvent.change(screen.getByLabelText("Город"), { target: { value: "c-konaev" } });
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
  });

  // Stage 8Б-5: Марка → Модель.
  it("the model select is disabled until a make is chosen, and offers only that make's models", () => {
    renderForm();

    const modelSelect = screen.getByLabelText("Модель") as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("option", { name: "Rio" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();
  });

  it("changing the make resets a previously selected model", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).value).toBe("");
  });
});
