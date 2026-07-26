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
import { createListing } from "@/lib/api/listings";
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
import { ImageUrlField } from "@/features/listings/ImageUrlField";

const TOTAL_STEPS = 3;

export function ListingForm() {
  const router = useRouter();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
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
      const { saleMode: mode, images, ...rest } = values;
      await createListing(token as string, {
        ...rest,
        isExchange: mode === "exchange",
        images: images.map((image) => image.url),
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "listings"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "overview"] });
      router.push("/dashboard/listings");
    } catch (err) {
      setApiError(
        err instanceof ApiError
          ? err.message
          : "Не удалось создать объявление, попробуйте позже",
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <span
            key={s}
            className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-brand" : "bg-border")}
          />
        ))}
      </div>

      {apiError ? <p className="text-[13px] text-destructive">{apiError}</p> : null}

      {step === 1 ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">Основное</h2>
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
            <Input
              label="Год выпуска"
              type="number"
              inputMode="numeric"
              placeholder="2021"
              error={errors.year?.message}
              {...register("year", { valueAsNumber: true })}
            />
            <Input
              label="Пробег, км"
              type="number"
              inputMode="numeric"
              placeholder="45000"
              error={errors.mileageKm?.message}
              {...register("mileageKm", { valueAsNumber: true })}
            />
          </div>
          <Select label="Регион" error={errors.region?.message} {...register("region")}>
            <option value="">Выберите регион</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">Характеристики</h2>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Коробка"
              error={errors.transmission?.message}
              {...register("transmission")}
            >
              <option value="">Выберите</option>
              {Object.entries(transmissionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              label="Привод"
              error={errors.drivetrain?.message}
              {...register("drivetrain")}
            >
              <option value="">Выберите</option>
              {Object.entries(drivetrainLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Тип топлива" error={errors.fuelType?.message} {...register("fuelType")}>
              <option value="">Выберите</option>
              {Object.entries(fuelTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="Кузов" error={errors.bodyType?.message} {...register("bodyType")}>
              <option value="">Выберите</option>
              {Object.entries(bodyTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Объём двигателя, л"
              type="number"
              step="0.1"
              inputMode="decimal"
              placeholder="2.0"
              error={errors.engineVolume?.message}
              {...register("engineVolume", { valueAsNumber: true })}
            />
            <Input
              label="Мощность, л.с."
              type="number"
              inputMode="numeric"
              placeholder="150"
              error={errors.enginePower?.message}
              {...register("enginePower", { valueAsNumber: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Цвет"
              placeholder="Белый"
              error={errors.color?.message}
              {...register("color")}
            />
            <Select
              label="Руль"
              error={errors.steeringWheel?.message}
              {...register("steeringWheel")}
            >
              {Object.entries(steeringWheelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-[17px] font-semibold text-foreground">Цена и фото</h2>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted-foreground">
              Способ продажи
            </span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={cn(
                  "cursor-pointer rounded-xl border p-4 transition-colors",
                  saleMode === "classified"
                    ? "border-brand bg-brand-light"
                    : "border-border bg-surface hover:border-foreground/30",
                )}
              >
                <input type="radio" value="classified" className="sr-only" {...register("saleMode")} />
                <span className="block text-[15px] font-semibold text-foreground">
                  Обычная продажа
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  Фиксированная цена, покупатель звонит напрямую
                </span>
              </label>
              <label
                className={cn(
                  "cursor-pointer rounded-xl border p-4 transition-colors",
                  saleMode === "exchange"
                    ? "border-brand bg-brand-light"
                    : "border-border bg-surface hover:border-foreground/30",
                )}
              >
                <input type="radio" value="exchange" className="sr-only" {...register("saleMode")} />
                <span className="block text-[15px] font-semibold text-foreground">
                  Автобиржа
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  Цена снижается на 1% в сутки, пока не встретится с
                  предложением покупателя
                </span>
              </label>
            </div>
          </div>

          <Input
            label="Цена, ₸"
            type="number"
            inputMode="numeric"
            placeholder="9500000"
            error={errors.price?.message}
            {...register("price", { valueAsNumber: true })}
          />
          <Textarea
            label="Описание (необязательно)"
            placeholder="Расскажите об истории обслуживания, комплектации..."
            error={errors.description?.message}
            {...register("description")}
          />
          <ImageUrlField fieldArray={imageFieldArray} error={errors.images?.message} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        {step > 1 ? (
          <Button type="button" variant="secondary" onClick={handleBack}>
            Назад
          </Button>
        ) : (
          <span />
        )}

        {step < TOTAL_STEPS ? (
          <Button type="button" onClick={handleNext}>
            Далее
          </Button>
        ) : (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Публикуем…" : "Опубликовать объявление"}
          </Button>
        )}
      </div>
    </form>
  );
}
