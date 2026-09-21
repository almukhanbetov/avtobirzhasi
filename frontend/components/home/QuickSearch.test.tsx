import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listRegions, listCitiesByRegion, listDistrictsByCity } from "@/lib/api/locations";
import { QuickSearch } from "./QuickSearch";

// Stage 7Б: QuickSearch's region <Select> is replaced by the shared
// LocationSelector (unchanged since Stage 5А) with its own local state,
// submitted on the existing "Найти" button click — this suite checks the
// URL contract QuickSearch hands to /cars (regionId/cityId/districtId +
// derived legacy `region` text, same as the catalog's FilterForm from
// Stage 7А) and that make/model/year/price are unaffected.
//
// Stage 8Б-1: every findBy* below waits on LocationSelector's regions/
// cities useQuery to resolve — under heavy CPU contention in the test
// environment (confirmed by forcing it: FilterForm.test.tsx and
// RequestForm.test.tsx, which wait on the exact same query in the exact
// same way, both missed RTL's default 1000ms findBy* timeout when the
// machine was saturated) that resolution can legitimately take longer
// than 1s of wall-clock time without anything in LocationSelector or
// QuickSearch itself being wrong. An explicit longer timeout here isn't
// weakening the assertion — it still requires the exact same option/text
// to appear, just allows realistic scheduling delay before failing.
const LOCATION_QUERY_TIMEOUT = { timeout: 3000 };

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
}));

const almatyRegion = {
  id: "r-almaty-obl",
  nameRu: "Алматинская область",
  nameKz: "Алматы облысы",
  kind: "oblast" as const,
  isSpecial: false,
};
const astanaRegion = {
  id: "r-astana",
  nameRu: "город Астана",
  nameKz: "Астана қаласы",
  kind: "republican_city" as const,
  isSpecial: true,
};
const konaev = { id: "c-konaev", regionId: "r-almaty-obl", nameRu: "Конаев", nameKz: "Қонаев" };
const astanaCity = { id: "c-astana", regionId: "r-astana", nameRu: "Астана", nameKz: "Астана" };

beforeEach(() => {
  push.mockClear();
  vi.mocked(listRegions).mockReset();
  vi.mocked(listCitiesByRegion).mockReset();
  vi.mocked(listDistrictsByCity).mockReset();
  vi.mocked(listRegions).mockResolvedValue([almatyRegion, astanaRegion]);
  vi.mocked(listCitiesByRegion).mockImplementation(async (regionId: string) => {
    if (regionId === "r-almaty-obl") return [konaev];
    if (regionId === "r-astana") return [astanaCity];
    return [];
  });
  vi.mocked(listDistrictsByCity).mockResolvedValue([]);
});

function renderQuickSearch() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <QuickSearch />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: /найти/i }).closest("form")!);
}

describe("QuickSearch", () => {
  it("navigates to a bare /cars when nothing is selected", () => {
    renderQuickSearch();
    submit();
    expect(push).toHaveBeenCalledWith("/cars");
  });

  it("submits regionId and the derived region text together, alongside make/model", async () => {
    renderQuickSearch();
    await screen.findByRole("option", { name: "Алматинская область" }, LOCATION_QUERY_TIMEOUT);

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });
    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "Camry" } });

    submit();

    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/cars");
    expect(url.searchParams.get("regionId")).toBe("r-almaty-obl");
    expect(url.searchParams.get("region")).toBe("Алматинская область");
    expect(url.searchParams.get("cityId")).toBeNull();
    expect(url.searchParams.get("make")).toBe("Toyota");
    expect(url.searchParams.get("model")).toBe("Camry");
  });

  it("submits cityId and its region context together when a city is picked", async () => {
    renderQuickSearch();
    await screen.findByRole("option", { name: "Алматинская область" }, LOCATION_QUERY_TIMEOUT);
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });
    await screen.findByRole("option", { name: "Конаев" }, LOCATION_QUERY_TIMEOUT);
    fireEvent.change(screen.getByLabelText("Город"), { target: { value: "c-konaev" } });

    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("regionId")).toBe("r-almaty-obl");
    expect(url.searchParams.get("cityId")).toBe("c-konaev");
    expect(url.searchParams.get("region")).toBe("Конаев");
  });

  it("republican city (Astana): no repeated city picker, cityId still reaches the URL", async () => {
    renderQuickSearch();
    await screen.findByRole("option", { name: "город Астана" }, LOCATION_QUERY_TIMEOUT);

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-astana" } });

    expect(await screen.findByText(/Город: Астана/, undefined, LOCATION_QUERY_TIMEOUT)).toBeTruthy();
    expect(screen.queryByLabelText("Город")).toBeNull();
    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("regionId")).toBe("r-astana");
    expect(url.searchParams.get("cityId")).toBe("c-astana");
  });

  it("splits a selected price range into priceFrom/priceTo", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/цена/i), { target: { value: "5000000-10000000" } });
    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("priceFrom")).toBe("5000000");
    expect(url.searchParams.get("priceTo")).toBe("10000000");
  });

  it("the model select is disabled until a make is chosen, and offers only that make's models", () => {
    renderQuickSearch();

    const modelSelect = screen.getByLabelText(/модель/i) as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Kia" } });

    expect(modelSelect.disabled).toBe(false);
    expect(screen.getByRole("option", { name: "Rio" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();

    fireEvent.change(modelSelect, { target: { value: "Rio" } });
    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("make")).toBe("Kia");
    expect(url.searchParams.get("model")).toBe("Rio");
  });

  it("changing the make resets a previously selected model", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "Camry" } });

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Kia" } });

    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("make")).toBe("Kia");
    expect(url.searchParams.has("model")).toBe(false);
  });
});

// Stage 8Б-6: investigated a report that "the Model field on the home
// page doesn't open" — reproduced with real (unmocked) lib/mock/cars
// data via fireEvent, not just read the source. Conclusion: no code
// defect found. The field is disabled exactly when no make is chosen
// (scenario А) — that's the Марка → Модель dependency required by
// Stage 8Б-5, not a bug; scenario Б (a make is chosen) enables it and
// populates it correctly. These 6 tests pin down both scenarios
// explicitly against real production data, not fixtures, so a genuine
// future regression here would actually fail a test.
describe("QuickSearch — Марка → Модель regression (Stage 8Б-6)", () => {
  it("selecting Toyota shows Toyota's models", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Toyota" } });

    expect(screen.getByRole("option", { name: "Camry" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "RAV4" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "X5" })).toBeNull();
  });

  it("selecting BMW shows BMW's models", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "BMW" } });

    const modelSelect = screen.getByLabelText(/модель/i) as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(false);
    expect(screen.getByRole("option", { name: "X5" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "3-Series" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();
  });

  it("switching from Toyota to BMW resets the selected model", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "Camry" } });
    expect((screen.getByLabelText(/модель/i) as HTMLSelectElement).value).toBe("Camry");

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "BMW" } });

    expect((screen.getByLabelText(/модель/i) as HTMLSelectElement).value).toBe("");
  });

  it("the model field is unavailable while no make is selected (by design, not a bug)", () => {
    renderQuickSearch();

    const modelSelect = screen.getByLabelText(/модель/i) as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(true);
    // Only the placeholder option exists — nothing from any brand leaks in.
    expect(modelSelect.options.length).toBe(1);
  });

  it("make and model both survive into the /cars search URL together", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "BMW" } });
    fireEvent.change(screen.getByLabelText(/модель/i), { target: { value: "X5" } });
    submit();

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.searchParams.get("make")).toBe("BMW");
    expect(url.searchParams.get("model")).toBe("X5");
  });
});
