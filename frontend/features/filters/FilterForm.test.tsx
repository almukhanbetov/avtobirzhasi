import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listRegions, listCitiesByRegion, listDistrictsByCity, resolveLegacyRegionText } from "@/lib/api/locations";
import { parseCarFilters } from "@/features/listings/filterCars";
import type { RawSearchParams } from "@/lib/url/searchParams";
import { FilterForm } from "./FilterForm";

// Stage 7А: FilterForm's region <Select> is replaced by LocationSelector
// (unchanged since Stage 5А). The cascade/reset/stale-request logic
// itself is already covered by features/location/LocationSelector.test.tsx
// — this suite only checks the catalog-specific URL wiring: one combined
// navigation per location change, other filters/page preserved, the
// legacy-text resolution never auto-navigating, and republican cities.
//
// router.push is simulated as a real Next.js navigation would be: the
// Harness below holds the URL's query string in React state and re-derives
// `values` via the real parseCarFilters on every push, so a chain like
// "region change -> LocationSelector's own republican-city auto-select
// effect -> a second push" round-trips exactly like the real SSR page.
//
// Stage 8Б-5: every findBy* below waits on a useQuery-driven <Select> to
// populate, same as QuickSearch.test.tsx (Stage 8Б-1) — and the make list
// this form also renders grew substantially in this stage (10 -> 46
// brands), so this suite is more prone to missing RTL's default 1000ms
// findBy* timeout under ordinary full-suite parallel load than it used
// to be (confirmed: it started failing deterministically in the full
// `npm run test` run, though never in isolation). Same fix as 8Б-1 — a
// longer explicit timeout, not a weaker assertion.
const LOCATION_QUERY_TIMEOUT = { timeout: 3000 };

const push = vi.fn();
let currentSearch = "";
// Reassigned by the currently-mounted Harness on every render — push's
// mock implementation calls it synchronously, no ref/effect indirection
// needed since it's a plain function reference, not a stale closure.
let commitSearch: (search: string) => void = () => {};
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => {
      push(url);
      const [, query = ""] = url.split("?");
      commitSearch(query);
    },
  }),
  usePathname: () => "/cars",
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
  resolveLegacyRegionText: vi.fn(),
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

function toRawSearchParams(search: string): RawSearchParams {
  const params = new URLSearchParams(search);
  const out: RawSearchParams = {};
  for (const key of params.keys()) out[key] = params.get(key) ?? "";
  return out;
}

function Harness({ initialSearch }: { initialSearch: string }) {
  const [search, setSearch] = useState(initialSearch);
  // Bridging test-only module state from an effect (not render itself)
  // keeps this a pure render, per react-hooks/globals.
  useEffect(() => {
    commitSearch = setSearch;
  }, []);
  useEffect(() => {
    currentSearch = search;
  }, [search]);
  const values = parseCarFilters(toRawSearchParams(search));
  return <FilterForm values={values} />;
}

function renderFilterForm(search: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <Harness initialSearch={search} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

function lastPushedParams(): URLSearchParams {
  const url = vi.mocked(push).mock.calls.at(-1)?.[0] as string;
  const [, query = ""] = url.split("?");
  return new URLSearchParams(query);
}

beforeEach(() => {
  push.mockReset();
  currentSearch = "";
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
  vi.mocked(listDistrictsByCity).mockResolvedValue([]);
});

describe("FilterForm — LocationSelector integration (Stage 7А)", () => {
  it("picking a region navigates once with regionId and the derived region text, dropping page", async () => {
    renderFilterForm("page=3");
    await screen.findByRole("option", { name: "Алматинская область" }, LOCATION_QUERY_TIMEOUT);

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const params = lastPushedParams();
    expect(params.get("regionId")).toBe("r-almaty-obl");
    expect(params.get("region")).toBe("Алматинская область");
    expect(params.has("page")).toBe(false);
  });

  it("picking a city after a region is a single combined navigation", async () => {
    renderFilterForm("regionId=r-almaty-obl");
    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));
    await screen.findByRole("option", { name: "Конаев" }, LOCATION_QUERY_TIMEOUT);

    fireEvent.change(screen.getByLabelText("Город"), { target: { value: "c-konaev" } });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const params = lastPushedParams();
    expect(params.get("regionId")).toBe("r-almaty-obl");
    expect(params.get("cityId")).toBe("c-konaev");
    expect(params.get("region")).toBe("Конаев");
  });

  it("changing the region drops the previously selected city from the URL", async () => {
    renderFilterForm("regionId=r-almaty-obl&cityId=c-konaev");
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const params = lastPushedParams();
    expect(params.get("regionId")).toBe("r-almaty-city");
    expect(params.has("cityId")).toBe(false);
  });

  it("Almaty (republican_city): no repeated city picker, auto cityId reaches the URL", async () => {
    renderFilterForm("");
    await screen.findByRole("option", { name: "город Алматы" }, LOCATION_QUERY_TIMEOUT);

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
    expect(await screen.findByText(/Город: Алматы/, undefined, LOCATION_QUERY_TIMEOUT)).toBeTruthy();

    await waitFor(() => expect(push).toHaveBeenCalled());
    const params = lastPushedParams();
    expect(params.get("regionId")).toBe("r-almaty-city");
    expect(params.get("cityId")).toBe("c-almaty");
  });

  it("removing a location filter clears regionId/cityId/districtId but keeps other filters", async () => {
    renderFilterForm("regionId=r-almaty-obl&cityId=c-konaev&make=Toyota&priceFrom=1000000");
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "" } });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const params = lastPushedParams();
    expect(params.has("regionId")).toBe(false);
    expect(params.has("cityId")).toBe(false);
    expect(params.get("make")).toBe("Toyota");
    expect(params.get("priceFrom")).toBe("1000000");
  });

  it("an old ?region= text link resolves for display without auto-navigating", async () => {
    vi.mocked(resolveLegacyRegionText).mockResolvedValue({ regionId: "r-almaty-obl", cityId: "c-konaev" });
    renderFilterForm("region=" + encodeURIComponent("Конаев"));

    await waitFor(() => expect(resolveLegacyRegionText).toHaveBeenCalledWith("Конаев"));
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));
    expect(push).not.toHaveBeenCalled();
  });
});

// Stage 8Б-5: Марка → Модель.
describe("FilterForm — make/model cascade (Stage 8Б-5)", () => {
  it("the model filter is disabled until a make is chosen, and offers only that make's models", () => {
    renderFilterForm("");

    const modelSelect = screen.getByLabelText("Модель") as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("option", { name: "Rio" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();
  });

  it("picking a make navigates once and drops any previously selected model", async () => {
    renderFilterForm("make=Toyota&model=Camry");

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const params = lastPushedParams();
    expect(params.get("make")).toBe("Kia");
    expect(params.has("model")).toBe(false);
  });

  it("an old ?model= value outside the curated list for the current make still shows as selected", () => {
    renderFilterForm("make=Toyota&model=Corona");

    const modelSelect = screen.getByLabelText("Модель") as HTMLSelectElement;
    expect(modelSelect.value).toBe("Corona");
    expect(screen.getByRole("option", { name: "Corona" })).toBeTruthy();
  });
});
