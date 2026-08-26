import { describe, expect, it } from "vitest";
import { formatMileage, formatTenge } from "./money";

// Intl.NumberFormat's ru-RU grouping separator is U+00A0 (non-breaking
// space), not a regular space — visually identical, but a plain " " in an
// expectation string fails Object.is equality against it.
const NBSP = " ";

describe("formatTenge", () => {
  it("space-groups thousands and appends the tenge sign", () => {
    expect(formatTenge(11_682_000)).toBe(`11${NBSP}682${NBSP}000${NBSP}₸`);
  });

  it("handles amounts under a thousand without a group separator", () => {
    expect(formatTenge(999)).toBe(`999${NBSP}₸`);
  });

  it("handles zero", () => {
    expect(formatTenge(0)).toBe(`0${NBSP}₸`);
  });
});

describe("formatMileage", () => {
  it("space-groups thousands and appends км", () => {
    expect(formatMileage(125_000)).toBe(`125${NBSP}000 км`);
  });

  it("handles zero mileage", () => {
    expect(formatMileage(0)).toBe("0 км");
  });
});
