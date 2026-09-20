"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { requestSchema, type RequestFormValues } from "@/lib/validation/request";
import { createRequest } from "@/lib/api/requests";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { makes, modelsByMake, years } from "@/lib/mock/cars";
import { LocationSelector, type LocationValue } from "@/features/location/LocationSelector";
import { listRegions, listCitiesByRegion } from "@/lib/api/locations";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function RequestForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({ resolver: zodResolver(requestSchema) });

  const regionId = watch("regionId");
  const cityId = watch("cityId");
  const districtId = watch("districtId");

  // Марка → Модель: same reference and fallback-preservation rule as
  // ListingForm (Stage 8Б-5) — see modelsByMake's doc comment.
  const make = watch("make");
  const currentModel = watch("model");
  const makeRegister = register("make");
  const knownModels = make ? (modelsByMake[make] ?? []) : [];
  const modelOptions =
    currentModel && !knownModels.includes(currentModel)
      ? [currentModel, ...knownModels]
      : knownModels;

  // Same derivation as ListingForm's create path (Stage 5Б): the legacy
  // `region` text — still what Match reads — is the selected city's name
  // if any, else the region's, reusing the same react-query cache
  // LocationSelector itself populates.
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

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { regionId: locRegionId, cityId: locCityId, districtId: locDistrictId, ...rest } = values;
      await createRequest(token as string, {
        ...rest,
        regionId: locRegionId ?? undefined,
        cityId: locCityId ?? undefined,
        districtId: locDistrictId ?? undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "requests"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      router.push("/dashboard/requests");
    } catch (err) {
      setApiError(
        err instanceof ApiError
          ? err.message
          : t("requestForm.createError"),
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      {apiError ? <p className="text-[13px] text-destructive">{apiError}</p> : null}

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
        <Select
          label={t("requestForm.yearFrom")}
          error={errors.yearFrom?.message}
          {...register("yearFrom", { valueAsNumber: true })}
        >
          <option value="">{t("filters.from")}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <Select
          label={t("requestForm.yearTo")}
          error={errors.yearTo?.message}
          {...register("yearTo", { valueAsNumber: true })}
        >
          <option value="">{t("filters.to")}</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
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

      <Input
        label={t("requestForm.initialOffer")}
        type="number"
        inputMode="numeric"
        placeholder="8 000 000"
        error={errors.initialOffer?.message}
        {...register("initialOffer", { valueAsNumber: true })}
      />

      <p className="text-[13px] text-muted-foreground">
        {t("requestForm.growthNote")}
      </p>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? t("requestForm.creating") : t("dashboard.requests.createCta")}
      </Button>
    </form>
  );
}
