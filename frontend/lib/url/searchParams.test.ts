import { describe, expect, it } from "vitest";
import { buildHref, getParam } from "./searchParams";

describe("getParam", () => {
  it("returns the value for a plain string param", () => {
    expect(getParam({ region: "Алматы" }, "region")).toBe("Алматы");
  });

  it("returns the first entry for a duplicated (array) param", () => {
    expect(getParam({ region: ["Алматы", "Астана"] }, "region")).toBe("Алматы");
  });

  it("returns empty string for a missing param", () => {
    expect(getParam({}, "region")).toBe("");
  });
});

describe("buildHref", () => {
  it("carries forward existing params and applies overrides", () => {
    const href = buildHref("/cars", { region: "Алматы", page: "2" }, { page: 3 });
    expect(href).toBe("/cars?region=%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B&page=3");
  });

  it("deletes a param when the override is undefined or empty string", () => {
    const href = buildHref("/cars", { region: "Алматы" }, { region: undefined });
    expect(href).toBe("/cars");
  });

  it("returns a bare pathname when there are no params at all", () => {
    expect(buildHref("/cars", {}, {})).toBe("/cars");
  });

  it("appends multiple values for an array param from the current params", () => {
    const href = buildHref("/cars", { make: ["Toyota", "Kia"] }, {});
    expect(href).toBe("/cars?make=Toyota&make=Kia");
  });
});
