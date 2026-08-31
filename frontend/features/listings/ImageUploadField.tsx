"use client";

import {
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import type { UseFieldArrayReturn } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ListingFormValues } from "@/lib/validation/listing";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ApiError } from "@/lib/api/client";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_LISTING_IMAGES,
  uploadListingImages,
} from "@/lib/api/uploads";

// The listing photo picker. One hidden <input type="file"> is the single
// source of files; a visible "Добавить фото" button AND a drag-and-drop
// zone both feed the exact same handleFiles() path (validate → upload via
// POST /api/uploads/images → append returned URLs to the form's `images`
// field array). There is no separate upload flow for drag-and-drop.
//
// While an upload is in flight each file shows an object-URL preview
// (revoked as soon as the upload settles); committed photos render from
// their real served URL via a plain <img>.

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
  const [isDragging, setIsDragging] = useState(false);

  // Synchronous count of photos this component has committed to:
  // already-uploaded URLs in the form + files reserved by an in-flight
  // batch. Used for the max-count gate so rapid repeated drops can't race
  // past MAX_LISTING_IMAGES between renders (the `fields`/`pending` state
  // is a render behind). Mutated only from handlers, never during render.
  const countRef = useRef(0);
  // Nested dragenter/dragleave events fire per child element — count the
  // depth so the highlight only clears when the pointer actually leaves.
  const dragDepth = useRef(0);

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
  const atMax = totalCount >= MAX_LISTING_IMAGES;

  function resetInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  // The single entry point for files from ANY source (file input or drop).
  async function handleFiles(fileList: FileList | File[] | null) {
    const selected = fileList ? Array.from(fileList) : [];
    resetInput(); // so picking the same file again re-fires onChange
    if (selected.length === 0) return;

    setLocalError(null);

    if (countRef.current + selected.length > MAX_LISTING_IMAGES) {
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

    countRef.current += selected.length; // reserve before the await

    const entries: PendingUpload[] = selected.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return { key: pendingKeySeq++, previewUrl };
    });
    setPending((prev) => [...prev, ...entries]);

    try {
      const urls = await uploadListingImages(token, selected);
      for (const url of urls) append({ url }); // stays counted (reserved -> committed)
    } catch (err) {
      countRef.current -= selected.length; // batch failed: release the reservation
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

  // The dropzone stays usable while an earlier batch is still uploading
  // (handleFiles reserves its slots synchronously via countRef, so a
  // second drop can't race past the limit). Only a full gallery blocks it.
  function openPicker() {
    if (atMax) return;
    inputRef.current?.click();
  }

  function onDropzoneKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (atMax) return;
    dragDepth.current += 1;
    setIsDragging(true);
  }
  function onDragOver(e: DragEvent<HTMLDivElement>) {
    // Required: without preventDefault the browser opens the dropped file.
    e.preventDefault();
    if (!atMax && e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    // Required: stops the browser from navigating to / opening the file.
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (atMax) return;
    void handleFiles(e.dataTransfer?.files ?? null);
  }

  const shownError = localError ?? error;
  const dropzoneActive = isDragging && !atMax;

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

      {/* Drag-and-drop zone — also a large tappable / keyboard-activatable
          area that opens the same hidden file input. */}
      <div
        role="button"
        tabIndex={atMax ? -1 : 0}
        aria-label={t("listingForm.dropzoneAria")}
        aria-disabled={atMax || undefined}
        onClick={openPicker}
        onKeyDown={onDropzoneKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          atMax
            ? "cursor-not-allowed border-border opacity-50"
            : dropzoneActive
              ? "cursor-copy border-brand bg-brand-light text-brand-dark"
              : "cursor-pointer border-border bg-surface hover:border-foreground/40",
        )}
      >
        <UploadCloud
          size={24}
          strokeWidth={1.75}
          className={dropzoneActive ? "text-brand" : "text-muted-foreground"}
        />
        {dropzoneActive ? (
          <span className="text-[14px] font-medium text-brand-dark">
            {t("listingForm.dropzoneActive")}
          </span>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-foreground">
              {t("listingForm.dropzoneTitle")}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {t("listingForm.dropzoneSubtitle")}
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || atMax}
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
                onClick={() => {
                  countRef.current = Math.max(0, countRef.current - 1);
                  remove(index);
                }}
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
