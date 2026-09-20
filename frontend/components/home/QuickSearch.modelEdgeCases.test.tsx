import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { QuickSearch } from "./QuickSearch";

// Stage 8Б-6: none of the 47 real brands in lib/mock/cars.ts currently
// lacks a modelsByMake entry (checked directly — every make has at
// least one model), so this defensive path ("a make with no known
// models must never fall back to showing some other make's models") is
// exercised here with a synthetic brand injected via a mocked
// lib/mock/cars, not real data. Kept in its own file so the rest of
// QuickSearch.test.tsx can keep testing against real production data.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn().mockResolvedValue([]),
  listCitiesByRegion: vi.fn().mockResolvedValue([]),
  listDistrictsByCity: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/mock/cars", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mock/cars")>();
  return {
    ...actual,
    makes: [...actual.makes, "NoModelBrand"],
    modelsByMake: { ...actual.modelsByMake, NoModelBrand: [] },
  };
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

describe("QuickSearch — a make with no known models (Stage 8Б-6)", () => {
  it("shows no models at all, and never falls back to another make's models", () => {
    renderQuickSearch();

    fireEvent.change(screen.getByLabelText(/марка/i), { target: { value: "NoModelBrand" } });

    const modelSelect = screen.getByLabelText(/модель/i) as HTMLSelectElement;
    // Enabled (a make IS selected) but only the placeholder option exists.
    expect(modelSelect.disabled).toBe(false);
    expect(modelSelect.options.length).toBe(1);
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();
    expect(screen.queryByRole("option", { name: "X5" })).toBeNull();
  });
});
