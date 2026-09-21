"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { makes, modelsByMake } from "@/lib/mock/cars";
import {
  bodyTypeLabels,
  drivetrainLabels,
  fuelTypeLabels,
  steeringWheelLabels,
  transmissionLabels,
} from "@/lib/labels/car";
import { ImageUploadField } from "@/features/listings/ImageUploadField";
import { LocationSelector, type LocationValue } from "@/features/location/LocationSelector";
import { listRegions, listCitiesByRegion, resolveLegacyRegionText } from "@/lib/api/locations";
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
    setValue,
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
            regionId: listing.car.regionId ?? null,
            cityId: listing.car.cityId ?? null,
            districtId: listing.car.districtId ?? null,
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
  const regionId = watch("regionId");
  const cityId = watch("cityId");
  const districtId = watch("districtId");

  // Марка → Модель: the model <Select> only offers the selected make's
  // known models, plus the currently saved model itself if it isn't one
  // of them (an existing listing's model must never disappear from the
  // options just because the reference list doesn't happen to include
  // it — see modelsByMake's own doc comment in lib/mock/cars.ts).
  const make = watch("make");
  const currentModel = watch("model");
  const makeRegister = register("make");
  const knownModels = make ? (modelsByMake[make] ?? []) : [];
  const modelOptions =
    currentModel && !knownModels.includes(currentModel)
      ? [currentModel, ...knownModels]
      : knownModels;

  // LocationSelector (Stage 5А) only carries UUIDs. The legacy `region`
  // text field — still what Match reads — is derived here from whichever
  // name is most specific (city, else region), reusing the same
  // react-query cache LocationSelector itself populates. Used by both
  // create (Stage 5Б) and edit (Stage 5В).
  const regionsForTextQuery = useQuery({
    queryKey: ["locations", "regions"],
    queryFn: listRegions,
    staleTime: 5 * 60 * 1000,
  });
  const citiesForTextQuery = useQuery({
    queryKey: ["locations", "cities", regionId],
    queryFn: () => listCitiesByRegion(regionId as string),
    enabled: Boolean(regionId),
    staleTime: 5 * 60 * 1000,
  });

  function handleLocationChange(next: LocationValue) {
    setValue("regionId", next.regionId, { shouldValidate: true });
    setValue("cityId", next.cityId, { shouldValidate: true });
    setValue("districtId", next.districtId, { shouldValidate: true });

    const regionName = regionsForTextQuery.data?.find((r) => r.id === next.regionId)?.nameRu ?? "";
    const cityName = citiesForTextQuery.data?.find((c) => c.id === next.cityId)?.nameRu ?? "";
    setValue("region", cityName || regionName, { shouldValidate: true });
  }

  // Stage 5В: an old listing may have only the free-text `region` (no
  // regionId) — try an exact match against the reference data once, and
  // silently adopt it into the form's (client-side only) state so the
  // already-loaded LocationSelector shows the right region/city as soon
  // as it resolves. Never written to PostgreSQL by itself — only the
  // user's own explicit "Сохранить изменения" click does that (onSubmit
  // sends whatever regionId/cityId are in the form at that point, exactly
  // like any other field). If the user has already picked a location by
  // hand before this resolves, or if the match is ambiguous, nothing is
  // applied and the choice stays with the user.
  const needsLegacyMatch = isEdit && !!listing && !listing.car.regionId && !!listing.car.region;
  const legacyMatchAppliedRef = useRef(false);
  const legacyMatchQuery = useQuery({
    queryKey: ["locations", "legacy-match", listing?.car.region],
    queryFn: () => resolveLegacyRegionText(listing!.car.region),
    enabled: needsLegacyMatch,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!needsLegacyMatch || legacyMatchAppliedRef.current || !legacyMatchQuery.data) return;
    if (watch("regionId")) return; // user already picked something by hand
    legacyMatchAppliedRef.current = true;
    setValue("regionId", legacyMatchQuery.data.regionId, { shouldValidate: true });
    setValue("cityId", legacyMatchQuery.data.cityId, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLegacyMatch, legacyMatchQuery.data]);

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
      // regionId/cityId/districtId are destructured out here and
      // re-attached explicitly below to each payload, so `rest`'s spread
      // never silently carries them into a type that doesn't expect them.
      const { saleMode: chosenMode, images, regionId: locRegionId, cityId: locCityId, districtId: locDistrictId, ...rest } = values;
      const imageUrls = images.map((image) => image.url);

      if (isEdit && listing) {
        const payload: UpdateListingInput = {
          ...rest,
          images: imageUrls,
          regionId: locRegionId ?? undefined,
          cityId: locCityId ?? undefined,
          districtId: locDistrictId ?? undefined,
        };
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
        regionId: locRegionId ?? undefined,
        cityId: locCityId ?? undefined,
        districtId: locDistrictId ?? undefined,
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
          <Select
            label={t("quickSearch.make")}
            error={errors.make?.message}
            {...makeRegister}
            onChange={(e) => {
              makeRegister.onChange(e);
              setValue("model", "", { shouldValidate: true });
            }}
          >
            <option value="">{t("listingForm.chooseMake")}</option>
            {makes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select
            label={t("quickSearch.model")}
            error={errors.model?.message}
            disabled={!make}
            {...register("model")}
          >
            <option value="">{t("listingForm.chooseModel")}</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Select>
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
          <div className="flex flex-col gap-1.5">
            <LocationSelector
              value={{ regionId: regionId ?? null, cityId: cityId ?? null, districtId: districtId ?? null }}
              onChange={handleLocationChange}
            />
            {errors.region?.message ? (
              <span className="text-[13px] text-destructive">{errors.region.message}</span>
            ) : null}
          </div>
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
