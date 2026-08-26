"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { UseFieldArrayReturn } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import type { ListingFormValues } from "@/lib/validation/listing";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// There's no upload/storage backend (listings.images are plain URL
// strings — see migrations/00003_create_listing_images.sql), so sellers
// paste image links instead of uploading files. Thumbnails use a plain
// <img>, not next/image, since these are arbitrary user-supplied hosts
// that next.config.ts's remotePatterns allowlist doesn't cover.
export function ImageUrlField({
  fieldArray,
  error,
}: {
  fieldArray: UseFieldArrayReturn<ListingFormValues, "images">;
  error?: string;
}) {
  const { t } = useLanguage();
  const { fields, append, remove } = fieldArray;
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    append({ url: trimmed });
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-muted-foreground">
        {t("listingForm.photos")}
      </span>

      <div className="flex gap-2">
        <input
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={t("listingForm.photoUrlPlaceholder")}
          className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-foreground transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus:border-brand"
        />
        <Button type="button" variant="secondary" onClick={handleAdd}>
          <Plus size={18} />
        </Button>
      </div>

      {error ? <span className="text-[13px] text-destructive">{error}</span> : null}

      {fields.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={field.url}
                alt=""
                className="h-full w-full object-cover"
              />
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
        </div>
      ) : null}
    </div>
  );
}
