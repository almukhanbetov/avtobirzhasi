"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { archiveListing, updateListing } from "@/lib/api/listings";
import { ApiError } from "@/lib/api/client";
import { regions } from "@/lib/mock/cars";
import type { SellerListing } from "@/types/dashboard";

export function ListingRow({ listing }: { listing: SellerListing }) {
  const { lang, t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const status = listingStatusLabels[lang][listing.status];

  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(String(listing.car.price));
  const [mileageKm, setMileageKm] = useState(String(listing.car.mileageKm));
  const [region, setRegion] = useState(listing.car.region);
  const [color, setColor] = useState(listing.car.color);
  const [description, setDescription] = useState(listing.car.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard", "listings"] });

  const updateMutation = useMutation({
    mutationFn: () =>
      updateListing(token as string, listing.id, {
        ...(listing.car.isExchange ? {} : { price: Number(price) }),
        mileageKm: Number(mileageKm),
        region,
        color,
        description,
      }),
    onSuccess: () => {
      invalidate();
      setIsEditing(false);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : t("cars.empty.error.description"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => archiveListing(token as string, listing.id),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    updateMutation.mutate();
  }

  function handleDelete() {
    if (window.confirm(t("row.deleteConfirm"))) {
      deleteMutation.mutate();
    }
  }

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            {listing.car.make} {listing.car.model}
          </span>
          <button
            type="button"
            aria-label={t("row.cancelEdit")}
            onClick={() => setIsEditing(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {listing.car.isExchange ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-muted-foreground">
                {t("listingForm.price")}
              </span>
              <span className="text-[15px] text-foreground">
                {formatTenge(listing.car.price)} · {t("row.exchangePriceLocked")}
              </span>
            </div>
          ) : (
            <Input
              label={t("listingForm.price")}
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          )}
          <Input
            label={t("listingForm.mileage")}
            type="number"
            min={0}
            value={mileageKm}
            onChange={(e) => setMileageKm(e.target.value)}
            required
          />
          <Select label={t("quickSearch.region")} value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input
            label={t("specs.color")}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            required
          />
        </div>

        <Textarea
          label={t("listingForm.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        {formError ? <p className="text-[13px] text-destructive">{formError}</p> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("row.saving") : t("row.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setIsEditing(false)}
            disabled={updateMutation.isPending}
          >
            {t("row.cancelEdit")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-xl bg-background sm:h-16 sm:w-24">
        <Image
          src={listing.car.imageUrl}
          alt={`${listing.car.make} ${listing.car.model}`}
          fill
          sizes="150px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <span className="text-[15px] font-semibold text-foreground">
            {listing.car.make} {listing.car.model}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {t("row.updated")} {formatShortDate(listing.updatedAt, lang)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(listing.car.price)}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href={`/cars/${listing.car.id}`}
            className="text-[14px] font-semibold text-brand hover:text-brand-dark"
          >
            {t("row.open")}
          </Link>
          <button
            type="button"
            aria-label={t("row.edit")}
            onClick={() => setIsEditing(true)}
            disabled={listing.status !== "active" && listing.status !== "moderation"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={t("row.delete")}
            onClick={handleDelete}
            disabled={
              deleteMutation.isPending ||
              (listing.status !== "active" && listing.status !== "moderation")
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
