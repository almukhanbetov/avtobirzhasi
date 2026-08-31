"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  listingSchema,
  listingStepFields,
  type ListingFormValues,
} from "@/lib/validation/listing";
import { createListing, updateListing } from "@/lib/api/listings";
import type { UpdateListingInput } from "@/lib/api/listings";
import { updateAdminListing } from "@/lib/api/admin";
import type { SellerListing } from "@/types/dashboard";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { makes, regions } from "@/lib/mock/cars";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  steeringWheelLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import { ImageUploadField } from "@/features/listings/ImageUploadField";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const TOTAL_STEPS = 3;

export function ListingForm({
  mode = "create",
  listing,
  admin = false,
}: {
  mode?: "create" | "edit";
  listing?: SellerListing;
  // When true the edit submits through the admin endpoint
  // (updateAdminListing) and returns to /admin/listings — the form,
  // fields, photo drag-and-drop and validation are otherwise identical.
  admin?: boolean;
} = {}) {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const isEdit = mode === "edit" && !!listing;
  const priceLocked = isEdit && !!listing?.car.isExchange;
  const listBackHref = admin ? "/admin/listings" : "/dashboard/listings";
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues:
      isEdit && listing
        ? {
            make: listing.car.make,
            model: listing.car.model,
            year: listing.car.year,
            mileageKm: listing.car.mileageKm,
            region: listing.car.region,
            transmission: listing.car.transmission,
            fuelType: listing.car.fuelType,
            bodyType: listing.car.bodyType,
            drivetrain: listing.car.drivetrain,
            engineVolume: listing.car.engineVolume,
            enginePower: listing.car.enginePower,
            color: listing.car.color,
            steeringWheel: listing.car.steeringWheel,
            saleMode: listing.car.isExchange ? "exchange" : "classified",
            price: listing.car.price,
            description: listing.car.description ?? "",
            images: listing.car.images.map((url) => ({ url })),
          }
        : {
            steeringWheel: "left",
            mileageKm: 0,
            images: [],
            saleMode: "classified",
          },
  });

  const saleMode = watch("saleMode");

  const imageFieldArray = useFieldArray({ control, name: "images" });

  async function handleNext() {
    const valid = await trigger(listingStepFields[step as 1 | 2 | 3]);
    if (valid) setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
  }

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { saleMode: chosenMode, images, ...rest } = values;
      const imageUrls = images.map((image) => image.url);

      if (isEdit && listing) {
        const payload: UpdateListingInput = { ...rest, images: imageUrls };
        if (priceLocked) delete payload.price; // exchange price is engine-managed
        if (admin) {
          await updateAdminListing(token as string, listing.id, payload);
          await queryClient.invalidateQueries({ queryKey: ["admin", "listings"] });
          await queryClient.invalidateQueries({ queryKey: ["admin", "listing", listing.id] });
        } else {
          await updateListing(token as string, listing.id, payload);
          await queryClient.invalidateQueries({ queryKey: ["dashboard", "listings"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
        }
        setSaved(true);
        await new Promise((resolve) => setTimeout(resolve, 700));
        router.push(listBackHref);
        return;
      }

      await createListing(token as string, {
        ...rest,
        isExchange: chosenMode === "exchange",
        images: imageUrls,
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "listings"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      router.push("/dashboard/listings");
    } catch (err) {
      setApiError(
        err instanceof ApiError
          ? err.message
          : t(isEdit ? "listingForm.editError" : "listingForm.createError"),
      );
    }
  });

  const showStep = (n: 1 | 2 | 3) => isEdit || step === n;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {isEdit ? (
        <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
          {t("listingForm.editTitle")}
        </h1>
      ) : (
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-brand" : "bg-border")}
            />
          ))}
        </div>
      )}

      {apiError ? <p className="text-[13px] text-destructive">{apiError}</p> : null}
      {saved ? (
        <p className="text-[13px] font-medium text-success">{t("listingForm.saved")}</p>
      ) : null}

      {showStep(1) ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">{t("listingForm.stepBasics")}</h2>
          <Select label={t("quickSearch.make")} error={errors.make?.message} {...register("make")}>
            <option value="">{t("listingForm.chooseMake")}</option>
            {makes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </Select>
          <Input
            label={t("quickSearch.model")}
            placeholder="Например: Camry"
            error={errors.model?.message}
            {...register("model")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("listingForm.year")}
              type="number"
              inputMode="numeric"
              placeholder="2021"
              error={errors.year?.message}
              {...register("year", { valueAsNumber: true })}
            />
            <Input
              label={t("listingForm.mileage")}
              type="number"
              inputMode="numeric"
              placeholder="45000"
              error={errors.mileageKm?.message}
              {...register("mileageKm", { valueAsNumber: true })}
            />
          </div>
          <Select label={t("quickSearch.region")} error={errors.region?.message} {...register("region")}>
            <option value="">{t("listingForm.chooseRegion")}</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {showStep(2) ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">{t("specs.title")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t("specs.transmission")}
              error={errors.transmission?.message}
              {...register("transmission")}
            >
              <option value="">{t("listingForm.choose")}</option>
              {Object.entries(transmissionLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label={t("specs.drivetrain")}
              error={errors.drivetrain?.message}
              {...register("drivetrain")}
            >
              <option value="">{t("listingForm.choose")}</option>
              {Object.entries(drivetrainLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t("listingForm.fuelType")} error={errors.fuelType?.message} {...register("fuelType")}>
              <option value="">{t("listingForm.choose")}</option>
              {Object.entries(fuelTypeLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label={t("specs.bodyType")} error={errors.bodyType?.message} {...register("bodyType")}>
              <option value="">{t("listingForm.choose")}</option>
              {Object.entries(bodyTypeLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("listingForm.engineVolume")}
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="2.0"
              error={errors.engineVolume?.message}
              {...register("engineVolume", { valueAsNumber: true })}
            />
            <Input
              label={t("listingForm.enginePower")}
              type="number"
              inputMode="numeric"
              placeholder="150"
              error={errors.enginePower?.message}
              {...register("enginePower", { valueAsNumber: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("specs.color")}
              placeholder={t("listingForm.colorPlaceholder")}
              error={errors.color?.message}
              {...register("color")}
            />
            <Select
              label={t("specs.steeringWheel")}
              error={errors.steeringWheel?.message}
              {...register("steeringWheel")}
            >
              {Object.entries(steeringWheelLabels[lang]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {showStep(3) ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">{t("listingForm.stepPricePhotos")}</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-foreground">
              {t("listingForm.saleMode")}
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isEdit ? "cursor-default opacity-70" : "cursor-pointer",
                  saleMode === "classified"
                    ? "border-brand bg-brand-light"
                    : "border-border bg-surface hover:border-foreground/30",
                )}
              >
                <input
                  type="radio"
                  value="classified"
                  className="sr-only"
                  disabled={isEdit}
                  {...register("saleMode")}
                />
                <span className="block text-[15px] font-semibold text-foreground">
                  {t("listingForm.classifiedTitle")}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {t("listingForm.classifiedDescription")}
                </span>
              </label>
              <label
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isEdit ? "cursor-default opacity-70" : "cursor-pointer",
                  saleMode === "exchange"
                    ? "border-brand bg-brand-light"
                    : "border-border bg-surface hover:border-foreground/30",
                )}
              >
                <input
                  type="radio"
                  value="exchange"
                  className="sr-only"
                  disabled={isEdit}
                  {...register("saleMode")}
                />
                <span className="block text-[15px] font-semibold text-foreground">
                  {t("home.exchange.eyebrow")}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {t("listingForm.exchangeDescription")}
                </span>
              </label>
            </div>
          </div>

          <Input
            label={t("listingForm.price")}
            type="number"
            inputMode="numeric"
            placeholder="9500000"
            error={errors.price?.message}
            disabled={priceLocked}
            {...register("price", { valueAsNumber: true })}
          />
          {priceLocked ? (
            <p className="-mt-3 text-[12px] text-muted-foreground">
              {t("row.exchangePriceLocked")}
            </p>
          ) : null}
          <Textarea
            label={t("listingForm.description")}
            placeholder={t("listingForm.descriptionPlaceholder")}
            error={errors.description?.message}
            {...register("description")}
          />
          <ImageUploadField
            fieldArray={imageFieldArray}
            error={errors.images?.message}
            token={token as string}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {isEdit ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(listBackHref)}
              disabled={isSubmitting}
            >
              {t("listingForm.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || saved}>
              {isSubmitting ? t("listingForm.saving") : t("listingForm.saveChanges")}
            </Button>
          </>
        ) : (
          <>
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={handleBack}>
                {t("listingForm.back")}
              </Button>
            ) : (
              <span />
            )}

            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={handleNext}>
                {t("listingForm.next")}
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t("listingForm.publishing") : t("listingForm.publish")}
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
