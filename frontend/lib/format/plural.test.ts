import { describe, expect, it } from "vitest";
import { pluralizeCars } from "./plural";

describe("pluralizeCars", () => {
  it("returns the invariant Kazakh form regardless of count", () => {
    for (const count of [1, 2, 5, 11, 21, 100]) {
      expect(pluralizeCars(count, "kz")).toBe("көлік");
    }
  });

  it("applies Russian numeral agreement", () => {
    expect(pluralizeCars(1, "ru")).toBe("автомобиль");
    expect(pluralizeCars(21, "ru")).toBe("автомобиль");
    expect(pluralizeCars(2, "ru")).toBe("автомобиля");
    expect(pluralizeCars(3, "ru")).toBe("автомобиля");
    expect(pluralizeCars(4, "ru")).toBe("автомобиля");
    expect(pluralizeCars(24, "ru")).toBe("автомобиля");
    expect(pluralizeCars(5, "ru")).toBe("автомобилей");
    expect(pluralizeCars(0, "ru")).toBe("автомобилей");
  });

  it("treats the 11-14 teens as an exception to the 1/2-4 rules", () => {
    expect(pluralizeCars(11, "ru")).toBe("автомобилей");
    expect(pluralizeCars(12, "ru")).toBe("автомобилей");
    expect(pluralizeCars(13, "ru")).toBe("автомобилей");
    expect(pluralizeCars(14, "ru")).toBe("автомобилей");
  });
});
