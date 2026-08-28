import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadListingImages } from "@/lib/api/uploads";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadListingImages", () => {
  it("sends the files as multipart FormData under the 'images' field, with no manual Content-Type", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ urls: ["http://localhost:8080/uploads/x.png"] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array(4)], "car.png", { type: "image/png" });
    const urls = await uploadListingImages("tok", [file]);

    expect(urls).toEqual(["http://localhost:8080/uploads/x.png"]);

    const [, init] = vi.mocked(fetchMock).mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const body = init.body as FormData;
    expect(body.getAll("images")).toHaveLength(1);
    expect((body.get("images") as File).name).toBe("car.png");
    // The browser must set multipart/form-data + boundary itself.
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["Authorization"]).toBe("Bearer tok");
  });
});
