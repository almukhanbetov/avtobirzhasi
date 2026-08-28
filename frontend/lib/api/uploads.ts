import { apiFetch } from "@/lib/api/client";

// Accepted image MIME types — kept in sync with the backend's
// allowedImageTypes (backend/internal/handlers/uploads.go).
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MiB, matches maxImageBytes
export const MAX_LISTING_IMAGES = 10;

// uploadListingImages sends the raw files to the backend and returns the
// public URLs they're now served at. Those URLs are what the listing
// form submits in its `images` array — the create/update listing calls
// themselves stay plain JSON.
export async function uploadListingImages(
  token: string,
  files: File[],
): Promise<string[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  const res = await apiFetch<{ urls: string[] }>("/uploads/images", {
    method: "POST",
    token,
    body: formData,
  });
  return res.urls;
}
