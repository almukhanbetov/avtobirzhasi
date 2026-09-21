import { apiFetch } from "@/lib/api/client";

// Mirrors backend/internal/handlers/locations.go's response shapes
// exactly (see docs/LOCATION_IMPLEMENTATION.md Stage 4) — camelCase,
// {"items": [...]} envelope, UUID ids, both RU/KZ names (the backend
// never picks a language itself).

export interface LocationRegion {
  id: string;
  nameRu: string;
  nameKz: string;
  kind: "oblast" | "republican_city";
  isSpecial: boolean;
}

export interface LocationCity {
  id: string;
  regionId: string;
  nameRu: string;
  nameKz: string;
}

export interface LocationDistrict {
  id: string;
  kind: "administrative" | "urban";
  cityId?: string;
  regionId?: string;
  nameRu: string;
  nameKz: string;
}

interface LocationItems<T> {
  items: T[];
}

export function listRegions(): Promise<LocationRegion[]> {
  return apiFetch<LocationItems<LocationRegion>>("/regions").then((r) => r.items);
}

export function listCitiesByRegion(regionId: string): Promise<LocationCity[]> {
  return apiFetch<LocationItems<LocationCity>>(`/regions/${regionId}/cities`).then((r) => r.items);
}

export function listDistrictsByCity(cityId: string): Promise<LocationDistrict[]> {
  return apiFetch<LocationItems<LocationDistrict>>(`/cities/${cityId}/districts`).then((r) => r.items);
}

export interface ResolvedLegacyLocation {
  regionId: string;
  cityId: string | null;
}

// Stage 5В: an old listing may only have the free-text `region` field
// (no regionId), stored from the flat city list this project used before
// LocationSelector (see docs/LOCATION_IMPLEMENTATION.md Stage 1 — that
// text has always been a city name, not an oblast name). This tries an
// EXACT match against every city name first, then every region name —
// never a partial/substring match. Zero or multiple matches are treated
// as ambiguous and return null, leaving the choice to the user rather
// than guessing.
export async function resolveLegacyRegionText(
  regionText: string,
): Promise<ResolvedLegacyLocation | null> {
  const regions = await listRegions();
  const cityLists = await Promise.all(regions.map((r) => listCitiesByRegion(r.id)));
  const cityMatches = cityLists.flat().filter((c) => c.nameRu === regionText);
  if (cityMatches.length === 1) {
    return { regionId: cityMatches[0].regionId, cityId: cityMatches[0].id };
  }
  if (cityMatches.length === 0) {
    const regionMatches = regions.filter((r) => r.nameRu === regionText);
    if (regionMatches.length === 1) {
      return { regionId: regionMatches[0].id, cityId: null };
    }
  }
  return null;
}
