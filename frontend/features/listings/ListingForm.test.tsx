import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { createListing, updateListing } from "@/lib/api/listings";
import { listRegions, listCitiesByRegion, listDistrictsByCity, resolveLegacyRegionText } from "@/lib/api/locations";
import type { SellerListing } from "@/types/dashboard";
import { ListingForm } from "./ListingForm";

// Stage 5Б: ListingForm's create path now wires LocationSelector (Stage
// 5А) in place of the old flat region <Select>. This suite covers the
// integration points that are new here — region+city (and optional
// district) reaching the submitted payload as UUIDs alongside the
// legacy `region` text, the republican-city (Almaty/Astana/Shymkent)
// auto-city behaviour end to end, region-only (no city) still being a
// valid submission, and that edit mode is completely unaffected. The
// cascade/reset/stale-request logic itself is already covered by
// features/location/LocationSelector.test.tsx and is not re-tested here.

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

vi.mock("@/lib/api/listings", () => ({
  createListing: vi.fn(),
  updateListing: vi.fn(),
}));
// resolveLegacyRegionText is mocked directly (not exercised for real here)
// — its exact-match algorithm has its own dedicated test in
// lib/api/locations.test.ts. This suite only checks that ListingForm
// applies whatever it resolves to, correctly and without a network self-
// reference issue (resolveLegacyRegionText calls listRegions/
// listCitiesByRegion internally — mocking only those two here would still
// route through the *real*, un-mocked apiFetch inside it).
vi.mock("@/lib/api/locations", () => ({
  listRegions: vi.fn(),
  listCitiesByRegion: vi.fn(),
  listDistrictsByCity: vi.fn(),
  resolveLegacyRegionText: vi.fn(),
}));
vi.mock("@/lib/api/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/uploads")>();
  return { ...actual, uploadListingImages: vi.fn() };
});
vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => ({ token: "user-token", status: "authenticated", user: null, login: vi.fn(), logout: vi.fn() }),
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
const almalinsky = {
  id: "d-almaly",
  kind: "urban" as const,
  cityId: "c-konaev",
  nameRu: "Алмалинский район",
  nameKz: "Алмалы ауданы",
};

function renderCreate() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        <ListingForm />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

async function fillStep1({ withDistrict = false } = {}) {
  fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
  fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });
  fireEvent.change(screen.getByLabelText("Год выпуска"), { target: { value: "2020" } });
  fireEvent.change(screen.getByLabelText("Пробег, км"), { target: { value: "45000" } });

  await screen.findByRole("option", { name: "Алматинская область" });
  fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });
  await screen.findByRole("option", { name: "Конаев" });
  fireEvent.change(screen.getByLabelText("Город"), { target: { value: "c-konaev" } });

  if (withDistrict) {
    const districtSelect = await screen.findByLabelText("Район");
    fireEvent.change(districtSelect, { target: { value: "d-almaly" } });
  }
}

function fillStep2() {
  fireEvent.change(screen.getByLabelText("Коробка"), { target: { value: "automatic" } });
  fireEvent.change(screen.getByLabelText("Привод"), { target: { value: "fwd" } });
  fireEvent.change(screen.getByLabelText("Тип топлива"), { target: { value: "petrol" } });
  fireEvent.change(screen.getByLabelText("Кузов"), { target: { value: "sedan" } });
  fireEvent.change(screen.getByLabelText("Объём двигателя, л"), { target: { value: "2.5" } });
  fireEvent.change(screen.getByLabelText("Мощность, л.с."), { target: { value: "180" } });
  fireEvent.change(screen.getByLabelText("Цвет"), { target: { value: "белый" } });
}

async function fillStep3AndSubmit() {
  fireEvent.change(screen.getByLabelText("Цена, ₸"), { target: { value: "9500000" } });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  const { uploadListingImages } = await import("@/lib/api/uploads");
  vi.mocked(uploadListingImages).mockResolvedValue(["https://x/car.jpg"]);
  fireEvent.change(fileInput, {
    target: { files: [new File([new Uint8Array(4)], "car.png", { type: "image/png" })] },
  });
  await waitFor(() =>
    expect((screen.getByRole("button", { name: /опубликовать/i }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: /опубликовать/i }));
}

beforeEach(() => {
  push.mockReset();
  vi.mocked(createListing).mockReset();
  vi.mocked(createListing).mockResolvedValue({} as never);
  vi.mocked(updateListing).mockReset();
  vi.mocked(updateListing).mockResolvedValue({} as never);
  vi.mocked(listRegions).mockReset();
  vi.mocked(listCitiesByRegion).mockReset();
  vi.mocked(listDistrictsByCity).mockReset();
  vi.mocked(listRegions).mockResolvedValue([almatyRegion, almatyCityRegion]);
  vi.mocked(listCitiesByRegion).mockImplementation(async (regionId: string) => {
    if (regionId === "r-almaty-obl") return [konaev];
    if (regionId === "r-almaty-city") return [almatyTheCity];
    return [];
  });
  vi.mocked(listDistrictsByCity).mockImplementation(async (cityId: string) => {
    if (cityId === "c-konaev") return [almalinsky];
    return [];
  });
  vi.mocked(resolveLegacyRegionText).mockReset();
  vi.mocked(resolveLegacyRegionText).mockResolvedValue(null);
});

describe("ListingForm create — LocationSelector integration", () => {
  it("submits region, city and district as UUIDs alongside the derived legacy region text", async () => {
    renderCreate();
    await fillStep1({ withDistrict: true });
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByText("Коробка");
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByLabelText("Цена, ₸");
    await fillStep3AndSubmit();

    await waitFor(() =>
      expect(createListing).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({
          region: "Конаев",
          regionId: "r-almaty-obl",
          cityId: "c-konaev",
          districtId: "d-almaly",
        }),
      ),
    );
  });

  it("a region with no city chosen is still a valid, submittable location", async () => {
    renderCreate();
    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });
    fireEvent.change(screen.getByLabelText("Год выпуска"), { target: { value: "2020" } });
    fireEvent.change(screen.getByLabelText("Пробег, км"), { target: { value: "45000" } });
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });

    fireEvent.click(screen.getByRole("button", { name: /далее/i }));

    // Advancing past step 1 without a city means region-only validation passed.
    expect(await screen.findByText("Коробка")).toBeTruthy();
  });

  it("Almaty (republican_city): the one city is auto-selected, never shown as a picker, and reaches the payload", async () => {
    renderCreate();
    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });
    fireEvent.change(screen.getByLabelText("Год выпуска"), { target: { value: "2020" } });
    fireEvent.change(screen.getByLabelText("Пробег, км"), { target: { value: "45000" } });
    await screen.findByRole("option", { name: "город Алматы" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
    expect(await screen.findByText(/Город: Алматы/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByText("Коробка");
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByLabelText("Цена, ₸");
    await fillStep3AndSubmit();

    await waitFor(() =>
      expect(createListing).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({ region: "Алматы", regionId: "r-almaty-city", cityId: "c-almaty" }),
      ),
    );
  });
});

describe("ListingForm create — make/model cascade (Stage 8Б-5)", () => {
  it("the model select is disabled until a make is chosen, and offers only that make's models", () => {
    renderCreate();

    const modelSelect = screen.getByLabelText("Модель") as HTMLSelectElement;
    expect(modelSelect.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByRole("option", { name: "Rio" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Camry" })).toBeNull();
  });

  it("changing the make resets a previously selected model", () => {
    renderCreate();

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByLabelText("Модель"), { target: { value: "Camry" } });

    fireEvent.change(screen.getByLabelText("Марка"), { target: { value: "Kia" } });

    expect((screen.getByLabelText("Модель") as HTMLSelectElement).value).toBe("");
  });
});

describe("ListingForm — Stage 9Б-15: 'Обычная продажа' removed from create", () => {
  it("the sale-mode toggle is not rendered at all when creating a listing", () => {
    renderCreate();

    expect(screen.queryByText("Обычная продажа")).toBeNull();
    expect(screen.queryByText("Способ продажи")).toBeNull();
  });

  it("a new listing is always created as an exchange listing", async () => {
    renderCreate();
    await fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByText("Коробка");
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByLabelText("Цена, ₸");
    await fillStep3AndSubmit();

    await waitFor(() =>
      expect(createListing).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({ isExchange: true }),
      ),
    );
  });
});

// Production bug: selecting a valid model (e.g. Audi → A8) left the select
// showing "A8" while its own validation error ("Выберите модель") and red
// border stayed visible — the displayed value and the validated value had
// diverged. Root cause: the model <Select> relied only on the implicit
// onChange react-hook-form's own `register("model")` attaches to its
// uncontrolled ref. That's normally enough — but once step 1's fields have
// already been batch-validated once (e.g. clicking "Далее" with the step
// still empty, which calls `trigger()` over every step-1 field at once,
// including "model"), a later native DOM change on that same field no
// longer reliably re-triggers Zod revalidation for it, so `errors.model`
// is left stale even though the underlying value is correct. The make
// <Select> already avoided this exact trap with its own explicit
// `setValue(..., { shouldValidate: true })` call in onChange (used to
// reset+revalidate "model" on every make change) — the fix mirrors that
// same, already-established pattern onto the model <Select> itself,
// instead of relying on the implicit path.
describe("ListingForm create — model validation clears on selection (regression)", () => {
  function makeSelectEl() {
    return screen.getByLabelText("Марка") as HTMLSelectElement;
  }
  function modelSelectEl() {
    return screen.getByLabelText("Модель") as HTMLSelectElement;
  }
  function modelErrorText() {
    return screen.queryByText("Выберите модель", { selector: "span" });
  }

  it("1: model starts empty with no error shown", () => {
    renderCreate();
    expect(modelSelectEl().value).toBe("");
    expect(modelErrorText()).toBeNull();
  });

  it("2-7: exact production bug — Далее with nothing filled, then Audi → A8 must clear the error immediately", async () => {
    renderCreate();

    // Reproduces the real trigger: attempting to advance with the step
    // empty runs trigger() over every step-1 field at once, including
    // "model" — this is what left errors.model stale in production.
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));

    fireEvent.change(makeSelectEl(), { target: { value: "Audi" } });
    // Selecting a make alone must not satisfy model — it starts back at
    // "" and stays invalid until an actual model is chosen.
    expect(modelSelectEl().value).toBe("");

    fireEvent.change(modelSelectEl(), { target: { value: "A8" } });

    // 4: A8 is visible in the model select.
    expect(screen.getByRole("option", { name: "A8" })).toBeTruthy();
    // 5: form state contains the expected non-empty model value.
    expect(modelSelectEl().value).toBe("A8");
    // 6-7: the error and the select's own invalid state must clear —
    // Zod/react-hook-form validation is asynchronous, so this must be
    // awaited: asserting synchronously right after fireEvent would pass
    // even on the broken code, by accident, before validation settles.
    await waitFor(() => expect(modelSelectEl().getAttribute("aria-invalid")).toBe("false"));
    expect(modelErrorText()).toBeNull();
  });

  it("8: submit payload includes the selected model", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));

    fireEvent.change(makeSelectEl(), { target: { value: "Audi" } });
    fireEvent.change(modelSelectEl(), { target: { value: "A8" } });
    fireEvent.change(screen.getByLabelText("Год выпуска"), { target: { value: "2020" } });
    fireEvent.change(screen.getByLabelText("Пробег, км"), { target: { value: "45000" } });
    await screen.findByRole("option", { name: "Алматинская область" });
    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-obl" } });

    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByText("Коробка");
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));
    await screen.findByLabelText("Цена, ₸");
    await fillStep3AndSubmit();

    await waitFor(() =>
      expect(createListing).toHaveBeenCalledWith(
        "user-token",
        expect.objectContaining({ make: "Audi", model: "A8" }),
      ),
    );
  });

  it("9-11: switching Audi → Toyota clears A8, and a fresh Toyota model selection clears the error again", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /далее/i }));

    fireEvent.change(makeSelectEl(), { target: { value: "Audi" } });
    fireEvent.change(modelSelectEl(), { target: { value: "A8" } });
    expect(modelSelectEl().value).toBe("A8");

    // 9-10: switching make clears the previous model value — A8 must not
    // survive as a (now make-mismatched) leftover value or option.
    fireEvent.change(makeSelectEl(), { target: { value: "Toyota" } });
    expect(modelSelectEl().value).toBe("");
    expect(screen.queryByRole("option", { name: "A8" })).toBeNull();

    // 11: picking a real Toyota model clears the error the make-switch
    // itself re-armed, exactly like the Audi/A8 case above.
    fireEvent.change(modelSelectEl(), { target: { value: "Camry" } });
    expect(modelSelectEl().value).toBe("Camry");
    await waitFor(() => expect(modelSelectEl().getAttribute("aria-invalid")).toBe("false"));
    expect(modelErrorText()).toBeNull();
  });
});

describe("ListingForm edit — LocationSelector integration (Stage 5В)", () => {
  function fakeListing(overrides: Partial<SellerListing["car"]> = {}): SellerListing {
    return {
      id: "listing-1",
      status: "active",
      updatedAt: new Date().toISOString(),
      car: {
        id: "car-1", make: "Toyota", model: "Camry", year: 2019, price: 7_000_000,
        mileageKm: 1000, region: "Алматы", transmission: "automatic", fuelType: "petrol",
        bodyType: "sedan", drivetrain: "fwd", engineVolume: 2.5, enginePower: 181,
        color: "белый", steeringWheel: "left", imageUrl: "https://x/a.jpg", images: ["https://x/a.jpg"],
        sellerId: "s1", isExchange: false,
        ...overrides,
      },
    };
  }

  function renderEdit(car?: Partial<SellerListing["car"]>) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <LanguageProvider>
          <ListingForm mode="edit" listing={fakeListing(car)} />
        </LanguageProvider>
      </QueryClientProvider>,
    );
  }

  it("restores the listing's saved region, city and district once their data loads", async () => {
    renderEdit({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev", districtId: "d-almaly" });

    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));
    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));
    await waitFor(() =>
      expect((screen.getByLabelText("Район") as HTMLSelectElement).value).toBe("d-almaly"),
    );
    expect(updateListing).not.toHaveBeenCalled();
  });

  it("a legacy listing (region text only, no regionId) resolves and pre-fills without saving anything on open", async () => {
    vi.mocked(resolveLegacyRegionText).mockResolvedValue({ regionId: "r-almaty-obl", cityId: "c-konaev" });
    renderEdit({ region: "Конаев", regionId: undefined, cityId: undefined, districtId: undefined });

    await waitFor(() => expect(resolveLegacyRegionText).toHaveBeenCalledWith("Конаев"));

    await waitFor(() => expect((screen.getByLabelText("Город") as HTMLSelectElement).value).toBe("c-konaev"));
    expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl");
    // Nothing is written to the backend just from opening the page.
    expect(updateListing).not.toHaveBeenCalled();
  });

  it("an existing model outside the curated list for its make still shows as selected (Stage 8Б-5)", async () => {
    renderEdit({ make: "Toyota", model: "Corona" });

    await waitFor(() => expect((screen.getByLabelText("Модель") as HTMLSelectElement).value).toBe("Corona"));
    expect(screen.getByRole("option", { name: "Corona" })).toBeTruthy();
  });

  it("Stage 9Б-15: an existing classified ('Обычная продажа') listing still shows its real, disabled sale mode", async () => {
    renderEdit({ isExchange: false });

    const classifiedRadio = screen.getByRole("radio", { name: /обычная продажа/i }) as HTMLInputElement;
    expect(classifiedRadio.checked).toBe(true);
    expect(classifiedRadio.disabled).toBe(true);
    const exchangeRadio = screen.getByRole("radio", { name: /автобиржа/i }) as HTMLInputElement;
    expect(exchangeRadio.disabled).toBe(true);
  });

  it("Almaty (republican_city) in edit mode: no repeated city picker, and saving sends the updated ids", async () => {
    renderEdit({ region: "Конаев", regionId: "r-almaty-obl", cityId: "c-konaev" });
    await waitFor(() => expect((screen.getByLabelText("Регион") as HTMLSelectElement).value).toBe("r-almaty-obl"));

    fireEvent.change(screen.getByLabelText("Регион"), { target: { value: "r-almaty-city" } });

    await waitFor(() => expect(screen.queryByLabelText("Город")).toBeNull());
    expect(await screen.findByText(/Город: Алматы/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /сохранить изменения/i }));

    await waitFor(() =>
      expect(updateListing).toHaveBeenCalledWith(
        "user-token",
        "listing-1",
        expect.objectContaining({
          region: "Алматы",
          regionId: "r-almaty-city",
          cityId: "c-almaty",
          // unrelated fields are untouched by the location change
          make: "Toyota",
          model: "Camry",
          price: 7_000_000,
        }),
      ),
    );
  });
});
