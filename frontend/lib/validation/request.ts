import { z } from "zod";

export const requestSchema = z
  .object({
    make: z.string().min(1, "Выберите марку"),
    model: z.string().min(1, "Введите модель"),
    yearFrom: z.number({ message: "Выберите год" }).int().min(1990, "Выберите год"),
    yearTo: z.number({ message: "Выберите год" }).int().min(1990, "Выберите год"),
    region: z.string().min(1, "Выберите регион"),
    initialOffer: z
      .number({ message: "Введите сумму" })
      .int()
      .min(100_000, "Минимум 100 000 ₸"),
  })
  .refine((data) => data.yearFrom <= data.yearTo, {
    message: "Год «от» не может быть больше года «до»",
    path: ["yearTo"],
  });

export type RequestFormValues = z.infer<typeof requestSchema>;
