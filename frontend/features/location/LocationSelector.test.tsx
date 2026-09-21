import { useMemo, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { listRegions, listCitiesByRegion, listDistrictsByCity } from "@/lib/api/locations";
import type { LocationCity, LocationDistrict, LocationRegion } from "@/lib/api/locations";
import { LocationSelector, EMPTY_LOCATION_VALUE, type LocationValue } from "./LocationSelector";

vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
}));

const almatyOblast: LocationRegion = {
  id: "r-almaty-obl",
  nameRu: "Алматинская область",
  nameKz: "Алматы облысы",
  kind: "oblast",
  isSpecial: false,
};
const akmola: LocationRegion = {
  id: "r-akmola",
  nameRu: "Акмолинская область",
  nameKz: "Ақмола облысы",
  kind: "oblast",
  isSpecial: false,
};
const almatyCity: LocationRegion = {
  id: "r-almaty-city",
  nameRu: "город Алматы",
  nameKz: "Алматы қаласы",
  kind: "republican_city",
  isSpecial: true,
};
const regions = [almatyOblast, akmola, almatyCity];

const konaev: LocationCity = { id: "c-konaev", regionId: "r-almaty-obl", nameRu: "Конаев", nameKz: "Қонаев" };
const kokshetau: LocationCity = { id: "c-kokshetau", regionId: "r-akmola", nameRu: "Кокшетау", nameKz: "Көкшетау" };
const almatyTheCity: LocationCity = { id: "c-almaty", regionId: "r-almaty-city", nameRu: "Алматы", nameKz: "Алматы" };

const almalinsky: LocationDistrict = {
  id: "d-almaly",
  kind: "urban",
  cityId: "c-almaty",
  nameRu: "Алмалинский район",
  nameKz: "Алмалы ауданы",
};

function Harness({ initialValue }: { initialValue?: LocationValue }) {
  const [value, setValue] = useState<LocationValue>(initialValue ?? EMPTY_LOCATION_VALUE);
  const qc = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
  return (
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <LocationSelector value={value} onChange={setValue} />
        <output data-testid="value">{JSON.stringify(value)}</output>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function regionSelect(): HTMLSelectElement {
  return screen.getByLabelText("Регион") as HTMLSelectElement;
}
function citySelect(): HTMLSelectElement {
  return screen.getByLabelText("Город") as HTMLSelectElement;
}

beforeEach(() => {
  vi.mocked(listRegions).mockReset();
  vi.mocked(listCitiesByRegion).mockReset();
  vi.mocked(listDistrictsByCity).mockReset();
  vi.mocked(listRegions).mockResolvedValue(regions);
  vi.mocked(listCitiesByRegion).mockImplementation(async (regionId: string) => {
    if (regionId === "r-almaty-obl") return [konaev];
    if (regionId === "r-akmola") return [kokshetau];
    if (regionId === "r-almaty-city") return [almatyTheCity];
    return [];
  });
  vi.mocked(listDistrictsByCity).mockImplementation(async (cityId: string) => {
    if (cityId === "c-almaty") return [almalinsky];
    return [];
  });
});

describe("LocationSelector", () => {
  it("loads regions, then loads and shows the selected region's cities", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "Алматинская область" });

    fireEvent.change(regionSelect(), { target: { value: "r-almaty-obl" } });

    expect(await screen.findByRole("option", { name: "Конаев" })).toBeTruthy();
    expect(listCitiesByRegion).toHaveBeenCalledWith("r-almaty-obl");
  });

  it("resets city and district when the region changes", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(regionSelect(), { target: { value: "r-almaty-obl" } });
    await screen.findByRole("option", { name: "Конаев" });
    fireEvent.change(citySelect(), { target: { value: "c-konaev" } });
    await waitFor(() => expect(screen.getByTestId("value").textContent).toContain("c-konaev"));

    fireEvent.change(regionSelect(), { target: { value: "r-akmola" } });

    await waitFor(() => expect(citySelect().value).toBe(""));
    expect(screen.getByTestId("value").textContent).not.toContain("c-konaev");
  });

  it("loads districts for the selected city and updates the value on selection", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "город Алматы" });
    fireEvent.change(regionSelect(), { target: { value: "r-almaty-city" } });

    const districtSelect = await screen.findByLabelText("Район");
    expect(listDistrictsByCity).toHaveBeenCalledWith("c-almaty");
    fireEvent.change(districtSelect, { target: { value: "d-almaly" } });

    await waitFor(() => expect(screen.getByTestId("value").textContent).toContain("d-almaly"));
  });

  it("a republican-significance region auto-selects its one city and hides the city picker", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "город Алматы" });

    fireEvent.change(regionSelect(), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.getByTestId("value").textContent).toContain("c-almaty"));
    expect(screen.queryByLabelText("Город")).toBeNull();
    expect(screen.getByText(/Город: Алматы/)).toBeTruthy();
  });

  it("a city with no districts renders no district picker", async () => {
    render(<Harness />);
    await screen.findByRole("option", { name: "Акмолинская область" });
    fireEvent.change(regionSelect(), { target: { value: "r-akmola" } });
    await screen.findByRole("option", { name: "Кокшетау" });
    fireEvent.change(citySelect(), { target: { value: "c-kokshetau" } });

    await waitFor(() => expect(listDistrictsByCity).toHaveBeenCalledWith("c-kokshetau"));
    expect(screen.queryByLabelText("Район")).toBeNull();
  });

  it("restores previously saved region/city/district UUIDs once their data loads", async () => {
    render(
      <Harness
        initialValue={{ regionId: "r-almaty-city", cityId: "c-almaty", districtId: "d-almaly" }}
      />,
    );

    const districtSelect = (await screen.findByLabelText("Район")) as HTMLSelectElement;
    await waitFor(() => expect(districtSelect.value).toBe("d-almaly"));
    expect((regionSelect()).value).toBe("r-almaty-city");
  });

  it("shows an error message when regions fail to load", async () => {
    vi.mocked(listRegions).mockReset();
    vi.mocked(listRegions).mockRejectedValue(new Error("network down"));
    render(<Harness />);

    expect(await screen.findByText(/не удалось загрузить/i)).toBeTruthy();
  });

  it("never renders a stale region's cities after a newer region has been selected", async () => {
    let resolveStale: (cities: LocationCity[]) => void = () => {};
    const stale = new Promise<LocationCity[]>((resolve) => {
      resolveStale = resolve;
    });
    vi.mocked(listCitiesByRegion).mockImplementation(async (regionId: string) => {
      if (regionId === "r-almaty-obl") return stale;
      if (regionId === "r-akmola") return [kokshetau];
      return [];
    });

    render(<Harness />);
    await screen.findByRole("option", { name: "Алматинская область" });

    fireEvent.change(regionSelect(), { target: { value: "r-almaty-obl" } });
    await screen.findByLabelText("Город"); // city select now mounted, request in flight
    fireEvent.change(regionSelect(), { target: { value: "r-akmola" } });
    await screen.findByRole("option", { name: "Кокшетау" });

    // The abandoned r-almaty-obl request finally resolves after the user
    // has already moved on to r-akmola.
    resolveStale([konaev]);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole("option", { name: "Конаев" })).toBeNull();
    expect(screen.getByRole("option", { name: "Кокшетау" })).toBeTruthy();
  });
});
