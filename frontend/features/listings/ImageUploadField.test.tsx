import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, createEvent } from "@testing-library/react";
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

describe("ImageUploadField — drag & drop", () => {
  function dropzone(): HTMLElement {
    return screen.getByRole("button", { name: /Загрузка фотографий/i });
  }
  const dt = (files: File[]) => ({ dataTransfer: { files, dropEffect: "" } });

  it("dragOver / dragEnter switches the zone to the active state", () => {
    render(<Harness />);
    expect(screen.getByText("Перетащите фотографии сюда")).toBeTruthy();

    fireEvent.dragEnter(dropzone(), dt([pngFile()]));
    fireEvent.dragOver(dropzone(), dt([pngFile()]));

    expect(screen.getByText("Отпустите фотографии здесь")).toBeTruthy();
    expect(screen.queryByText("Перетащите фотографии сюда")).toBeNull();
  });

  it("dragLeave restores the normal state", () => {
    render(<Harness />);
    fireEvent.dragEnter(dropzone(), dt([pngFile()]));
    expect(screen.getByText("Отпустите фотографии здесь")).toBeTruthy();

    fireEvent.dragLeave(dropzone(), dt([pngFile()]));

    expect(screen.getByText("Перетащите фотографии сюда")).toBeTruthy();
    expect(screen.queryByText("Отпустите фотографии здесь")).toBeNull();
  });

  it("drop feeds a single valid file into the same upload flow", async () => {
    vi.mocked(uploadListingImages).mockResolvedValue([
      "http://localhost:8080/uploads/dropped.png",
    ]);
    render(<Harness />);

    fireEvent.drop(dropzone(), dt([pngFile("dropped.png")]));

    await waitFor(() =>
      expect(uploadListingImages).toHaveBeenCalledWith("user-token", [
        expect.any(File),
      ]),
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
  });

  it("drop accepts multiple valid files in one upload request", async () => {
    vi.mocked(uploadListingImages).mockResolvedValue([
      "http://localhost:8080/uploads/a.jpg",
      "http://localhost:8080/uploads/b.webp",
      "http://localhost:8080/uploads/c.png",
    ]);
    render(<Harness />);

    fireEvent.drop(
      dropzone(),
      dt([
        new File([new Uint8Array(4)], "a.jpg", { type: "image/jpeg" }),
        new File([new Uint8Array(4)], "b.webp", { type: "image/webp" }),
        pngFile("c.png"),
      ]),
    );

    await waitFor(() => expect(uploadListingImages).toHaveBeenCalledTimes(1));
    expect(vi.mocked(uploadListingImages).mock.calls[0][1]).toHaveLength(3);
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("3"));
  });

  it("drop rejects an unsupported type without uploading", async () => {
    render(<Harness />);

    fireEvent.drop(
      dropzone(),
      dt([new File(["x"], "movie.mp4", { type: "video/mp4" })]),
    );

    expect(await screen.findByText(/только JPG, PNG и WebP/i)).toBeTruthy();
    expect(uploadListingImages).not.toHaveBeenCalled();
  });

  it("drop respects the max-images limit and uploads nothing over it", async () => {
    render(<Harness />);

    const eleven = Array.from({ length: 11 }, (_, i) => pngFile(`p${i}.png`));
    fireEvent.drop(dropzone(), dt(eleven));

    expect(await screen.findByText(/не больше 10 фотографий/i)).toBeTruthy();
    expect(uploadListingImages).not.toHaveBeenCalled();
  });

  it("clicking the dropzone opens the hidden file input", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<Harness />);

    fireEvent.click(dropzone());

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("Enter on the focused dropzone opens the hidden file input (a11y)", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<Harness />);

    fireEvent.keyDown(dropzone(), { key: "Enter" });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("calls preventDefault on dragOver and drop so the browser never opens the file", () => {
    vi.mocked(uploadListingImages).mockResolvedValue([]);
    render(<Harness />);

    const overEvent = createEvent.dragOver(dropzone(), dt([pngFile()]));
    fireEvent(dropzone(), overEvent);
    expect(overEvent.defaultPrevented).toBe(true);

    const dropEvent = createEvent.drop(dropzone(), dt([pngFile()]));
    fireEvent(dropzone(), dropEvent);
    expect(dropEvent.defaultPrevented).toBe(true);
  });

  it("the file input and the dropzone route through one shared handler", async () => {
    vi.mocked(uploadListingImages).mockResolvedValue([
      "http://localhost:8080/uploads/x.png",
    ]);
    render(<Harness />);

    fireEvent.change(fileInput(), { target: { files: [pngFile("via-input.png")] } });
    await waitFor(() => expect(uploadListingImages).toHaveBeenCalledTimes(1));

    fireEvent.drop(dropzone(), dt([pngFile("via-drop.png")]));
    await waitFor(() => expect(uploadListingImages).toHaveBeenCalledTimes(2));
    // same function, same call shape from both entry points
    expect(vi.mocked(uploadListingImages).mock.calls[0][1]).toHaveLength(1);
    expect(vi.mocked(uploadListingImages).mock.calls[1][1]).toHaveLength(1);
  });
});
