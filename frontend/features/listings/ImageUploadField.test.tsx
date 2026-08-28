import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm, useFieldArray } from "react-hook-form";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import type { ListingFormValues } from "@/lib/validation/listing";
import { uploadListingImages } from "@/lib/api/uploads";
import { ImageUploadField } from "./ImageUploadField";

vi.mock("@/lib/api/uploads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/uploads")>();
  return { ...actual, uploadListingImages: vi.fn() };
});

// jsdom implements neither of these.
beforeEach(() => {
  vi.mocked(uploadListingImages).mockReset();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

function Harness() {
  const { control } = useForm<ListingFormValues>({ defaultValues: { images: [] } });
  const fieldArray = useFieldArray({ control, name: "images" });
  return (
    <LanguageProvider>
      <ImageUploadField fieldArray={fieldArray} token="user-token" />
      <output data-testid="count">{fieldArray.fields.length}</output>
    </LanguageProvider>
  );
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

function pngFile(name = "car.png", bytes = 10) {
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

describe("ImageUploadField", () => {
  it("the Add Photo button opens the hidden file input", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<Harness />);

    fireEvent.click(screen.getByText("Добавить фото"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("uploads a selected image and shows it in the grid", async () => {
    vi.mocked(uploadListingImages).mockResolvedValue([
      "http://localhost:8080/uploads/abc123.png",
    ]);
    render(<Harness />);

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    await waitFor(() =>
      expect(uploadListingImages).toHaveBeenCalledWith("user-token", [
        expect.any(File),
      ]),
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    const img = document.querySelector(
      'img[src="http://localhost:8080/uploads/abc123.png"]',
    );
    expect(img).toBeTruthy();
  });

  it("rejects a non-image file without uploading", async () => {
    render(<Harness />);

    fireEvent.change(fileInput(), {
      target: { files: [new File(["hi"], "notes.txt", { type: "text/plain" })] },
    });

    expect(await screen.findByText(/только JPG, PNG и WebP/i)).toBeTruthy();
    expect(uploadListingImages).not.toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("rejects a file larger than 5 MB without uploading", async () => {
    render(<Harness />);

    fireEvent.change(fileInput(), {
      target: { files: [pngFile("huge.png", 5 * 1024 * 1024 + 1)] },
    });

    expect(await screen.findByText(/не больше 5 МБ/i)).toBeTruthy();
    expect(uploadListingImages).not.toHaveBeenCalled();
  });

  it("surfaces a server-side upload failure to the user", async () => {
    vi.mocked(uploadListingImages).mockRejectedValue(new Error("boom"));
    render(<Harness />);

    fireEvent.change(fileInput(), { target: { files: [pngFile()] } });

    expect(await screen.findByText(/Не удалось загрузить фото/i)).toBeTruthy();
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
