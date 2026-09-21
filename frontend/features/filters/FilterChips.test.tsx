import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { parseCarFilters } from "@/features/listings/filterCars";
import type { RawSearchParams } from "@/lib/url/searchParams";
import { FilterChips } from "./FilterChips";

// Stage 7А: the single "region" chip now represents regionId/cityId/
// districtId together (as it represented the old flat `region` text
// alone before) — removing it must clear all four URL keys at once, or a
// stale regionId would linger behind after the chip disappears.

function renderChips(search: string) {
  const raw: RawSearchParams = Object.fromEntries(new URLSearchParams(search));
  const filters = parseCarFilters(raw);
  return render(
    <LanguageProvider>
      <FilterChips filters={filters} searchParams={raw} />
    </LanguageProvider>,
  );
}

describe("FilterChips — location chip (Stage 7А)", () => {
  it("shows one chip for the derived region text and its href clears region/regionId/cityId/districtId", () => {
    renderChips("region=" + encodeURIComponent("Конаев") + "&regionId=r-almaty-obl&cityId=c-konaev&make=Toyota");

    const chip = screen.getByRole("link", { name: /Конаев/ });
    const href = chip.getAttribute("href") ?? "";
    expect(href).not.toContain("region=");
    expect(href).not.toContain("regionId=");
    expect(href).not.toContain("cityId=");
    expect(href).not.toContain("districtId=");
    // Unrelated filters must survive the location chip's removal.
    expect(href).toContain("make=Toyota");
  });

  it("shows no location chip when nothing is selected", () => {
    renderChips("make=Toyota");
    expect(screen.queryByRole("link", { name: /Конаев|Алматы/ })).toBeNull();
  });
});
