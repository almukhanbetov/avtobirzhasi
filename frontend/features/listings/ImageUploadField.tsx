"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { UseFieldArrayReturn } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import type { ListingFormValues } from "@/lib/validation/listing";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ApiError } from "@/lib/api/client";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  uploadListingImages,
} from "@/lib/api/uploads";

// The listing photo picker: a hidden <input type="file"> driven by a
// visible button. Selected files are validated client-side (type, size,
// count — same limits the backend enforces), uploaded to
// POST /api/uploads/images, and the returned public URLs are appended to
// the form's `images` field array. The create/update-listing request
// itself stays plain JSON and just carries those URLs.
//
// While an upload is in flight each file shows an object-URL preview
// (revoked as soon as the upload settles); committed photos render from
// their real served URL via a plain <img> (next/image isn't used here —
// the preview grid doesn't need optimization and it keeps the component
// free of layout-size juggling).

let pendingKeySeq = 0;

interface PendingUpload {
  key: number;
  previewUrl: string;
}

export function ImageUploadField({
  fieldArray,
  error,
  token,
}: {
  fieldArray: UseFieldArrayReturn<ListingFormValues, "images">;
  error?: string;
  token: string;
}) {
  const { t } = useLanguage();
  const { fields, append, remove } = fieldArray;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // Every object URL currently handed to an <img> preview. Mutated only
  // from the async handler and the unmount cleanup — never during render.
  const objectUrls = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const isUploading = pending.length > 0;
  const totalCount = fields.length + pending.length;

  function resetInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFiles(fileList: FileList | null) {
    const selected = fileList ? Array.from(fileList) : [];
    resetInput(); // so picking the same file again re-fires onChange
    if (selected.length === 0) return;

    setLocalError(null);

    if (totalCount + selected.length > MAX_LISTING_IMAGES) {
      setLocalError(t("listingForm.photoCountError"));
      return;
    }

    const wrongType = selected.some(
      (f) => !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(f.type),
    );
    if (wrongType) {
      setLocalError(t("listingForm.photoTypeError"));
      return;
    }
    const tooBig = selected.some((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      setLocalError(t("listingForm.photoSizeError"));
      return;
    }

    const entries: PendingUpload[] = selected.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return { key: pendingKeySeq++, previewUrl };
    });
    setPending((prev) => [...prev, ...entries]);

    try {
      const urls = await uploadListingImages(token, selected);
      for (const url of urls) append({ url });
    } catch (err) {
      setLocalError(
        err instanceof ApiError ? err.message : t("listingForm.photoUploadError"),
      );
    } finally {
      for (const e of entries) {
        URL.revokeObjectURL(e.previewUrl);
        objectUrls.current.delete(e.previewUrl);
      }
      setPending((prev) => prev.filter((p) => !entries.some((e) => e.key === p.key)));
    }
  }

  const shownError = localError ?? error;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-muted-foreground">
        {t("listingForm.photos")}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
        }}
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || totalCount >= MAX_LISTING_IMAGES}
        >
          {isUploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ImagePlus size={18} />
          )}
          {isUploading ? t("listingForm.uploadingPhotos") : t("listingForm.addPhoto")}
        </Button>
        <span className="text-[12px] text-muted-foreground">
          {t("listingForm.photoHint")}
        </span>
      </div>

      {shownError ? (
        <span className="text-[13px] text-destructive">{shownError}</span>
      ) : null}

      {fields.length > 0 || pending.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={field.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={t("listingForm.deletePhoto")}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div
              key={p.key}
              className="relative aspect-square overflow-hidden rounded-xl border border-border bg-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt=""
                className="h-full w-full object-cover opacity-40"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-foreground" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
