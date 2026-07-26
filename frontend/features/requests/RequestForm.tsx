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

export function RequestForm() {
  const router = useRouter();
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
          : "Не удалось создать заявку, попробуйте позже",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      {apiError ? <p className="text-[13px] text-destructive">{apiError}</p> : null}

      <Select label="Марка" error={errors.make?.message} {...register("make")}>
        <option value="">Выберите марку</option>
        {makes.map((make) => (
          <option key={make} value={make}>
            {make}
          </option>
        ))}
      </Select>

      <Input
        label="Модель"
        placeholder="Например: Camry"
        error={errors.model?.message}
        {...register("model")}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Год от"
          error={errors.yearFrom?.message}
          {...register("yearFrom", { valueAsNumber: true })}
        >
          <option value="">от</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <Select
          label="Год до"
          error={errors.yearTo?.message}
          {...register("yearTo", { valueAsNumber: true })}
        >
          <option value="">до</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>

      <Select label="Регион" error={errors.region?.message} {...register("region")}>
        <option value="">Выберите регион</option>
        {regions.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </Select>

      <Input
        label="Стартовое предложение, ₸"
        type="number"
        inputMode="numeric"
        placeholder="8 000 000"
        error={errors.initialOffer?.message}
        {...register("initialOffer", { valueAsNumber: true })}
      />

      <p className="text-[13px] text-muted-foreground">
        Ваше предложение будет автоматически расти на 1% в день, пока не
        найдётся подходящее объявление в пределах 2%.
      </p>

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Создаём заявку…" : "Создать заявку"}
      </Button>
    </form>
  );
}
