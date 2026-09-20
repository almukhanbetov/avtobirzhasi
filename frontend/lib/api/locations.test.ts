import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLegacyRegionText } from "@/lib/api/locations";

// resolveLegacyRegionText's exact-match algorithm (Stage 5В), exercised
// for real against a stubbed global fetch — not a mocked
// @/lib/api/locations, since resolveLegacyRegionText calls listRegions/
// listCitiesByRegion internally and a same-module partial mock would
// route those internal calls through the *real*, un-mocked
// implementation instead (see features/listings/ListingForm.test.tsx's
// note on the same issue).

const regions = [
  { id: "r-almaty-obl", nameRu: "Алматинская область", nameKz: "Алматы облысы", kind: "oblast", isSpecial: false },
  { id: "r-akmola", nameRu: "Акмолинская область", nameKz: "Ақмола облысы", kind: "oblast", isSpecial: false },
];
const almatyObl_cities = [{ id: "c-konaev", regionId: "r-almaty-obl", nameRu: "Конаев", nameKz: "Қонаев" }];
const akmola_cities = [{ id: "c-kokshetau", regionId: "r-akmola", nameRu: "Кокшетау", nameKz: "Көкшетау" }];

function stubFetch(citiesByRegion: Record<string, unknown[]> = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/regions")) {
      return { ok: true, status: 200, json: async () => ({ items: regions }) };
    }
    const match = url.match(/\/regions\/([^/]+)\/cities$/);
    if (match) {
      return { ok: true, status: 200, json: async () => ({ items: citiesByRegion[match[1]] ?? [] }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  stubFetch({ "r-almaty-obl": almatyObl_cities, "r-akmola": akmola_cities });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveLegacyRegionText", () => {
  it("resolves an exact city-name match to its region and city ids", async () => {
    const result = await resolveLegacyRegionText("Конаев");
    expect(result).toEqual({ regionId: "r-almaty-obl", cityId: "c-konaev" });
  });

  it("falls back to an exact region-name match when no city matches", async () => {
    const result = await resolveLegacyRegionText("Акмолинская область");
    expect(result).toEqual({ regionId: "r-akmola", cityId: null });
  });

  it("never does a partial/substring match", async () => {
    const result = await resolveLegacyRegionText("Кокшет"); // substring of "Кокшетау"
    expect(result).toBeNull();
  });

  it("returns null when nothing matches at all", async () => {
    const result = await resolveLegacyRegionText("Несуществующий Город");
    expect(result).toBeNull();
  });

  it("returns null (ambiguous) when the text matches more than one city", async () => {
    stubFetch({
      "r-almaty-obl": [{ id: "c-1", regionId: "r-almaty-obl", nameRu: "Дубликат", nameKz: "Дубликат" }],
      "r-akmola": [{ id: "c-2", regionId: "r-akmola", nameRu: "Дубликат", nameKz: "Дубликат" }],
    });
    const result = await resolveLegacyRegionText("Дубликат");
    expect(result).toBeNull();
  });
});
