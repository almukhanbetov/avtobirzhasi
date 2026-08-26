"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { requestSchema, type RequestFormValues } from "@/lib/validation/request";
import { createRequest } from "@/lib/api/requests";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { makes, regions, years } from "@/lib/mock/cars";
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
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({ resolver: zodResolver(requestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await createRequest(token as string, values);
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

      <Select label={t("quickSearch.region")} error={errors.region?.message} {...register("region")}>
        <option value="">{t("listingForm.chooseRegion")}</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </Select>

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
