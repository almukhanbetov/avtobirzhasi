import { describe, expect, it } from "vitest";
import { countActiveFilters, parseCarFilters } from "./filterCars";

describe("parseCarFilters", () => {
  it("defaults sort to newest and page to 1 when absent", () => {
    const filters = parseCarFilters({});
    expect(filters.sort).toBe("newest");
    expect(filters.page).toBe(1);
  });

  it("falls back to newest for an invalid sort value", () => {
    const filters = parseCarFilters({ sort: "not-a-real-sort" });
    expect(filters.sort).toBe("newest");
  });

  it("accepts every documented sort option", () => {
    for (const sort of ["newest", "price-asc", "price-desc", "year-desc"]) {
      expect(parseCarFilters({ sort }).sort).toBe(sort);
    }
  });

  it("clamps a non-positive page to 1", () => {
    expect(parseCarFilters({ page: "0" }).page).toBe(1);
    expect(parseCarFilters({ page: "-3" }).page).toBe(1);
    expect(parseCarFilters({ page: "abc" }).page).toBe(1);
  });

  it("parses numeric range params, treating blank/invalid as null", () => {
    const filters = parseCarFilters({
      yearFrom: "2018",
      yearTo: "",
      priceFrom: "not-a-number",
      priceTo: "5000000",
    });
    expect(filters.yearFrom).toBe(2018);
    expect(filters.yearTo).toBeNull();
    expect(filters.priceFrom).toBeNull();
    expect(filters.priceTo).toBe(5_000_000);
  });

  it("trims the model text filter", () => {
    expect(parseCarFilters({ model: "  Camry  " }).model).toBe("Camry");
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseCarFilters({ region: ["Алматы", "Астана"] }).region).toBe("Алматы");
  });
});

describe("countActiveFilters", () => {
  it("counts zero for an all-empty filter set", () => {
    expect(countActiveFilters(parseCarFilters({}))).toBe(0);
  });

  it("counts each populated field once", () => {
    const filters = parseCarFilters({
      region: "Алматы",
      make: "Toyota",
      yearFrom: "2018",
      priceTo: "5000000",
    });
    expect(countActiveFilters(filters)).toBe(4);
  });
});
