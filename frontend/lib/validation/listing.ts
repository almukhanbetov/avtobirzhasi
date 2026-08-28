import { z } from "zod";

export const listingSchema = z.object({
  make: z.string().min(1, "Выберите марку"),
  model: z.string().min(1, "Введите модель"),
  year: z.number({ message: "Выберите год" }).int().min(1990, "Выберите год"),
  mileageKm: z.number({ message: "Введите пробег" }).int().min(0, "Введите пробег"),
  region: z.string().min(1, "Выберите регион"),
  transmission: z.enum(["automatic", "manual"], { message: "Выберите коробку" }),
  fuelType: z.enum(["petrol", "diesel", "hybrid", "electric", "gas"], {
    message: "Выберите тип топлива",
  }),
  bodyType: z.enum(["sedan", "suv", "crossover", "hatchback", "coupe", "universal"], {
    message: "Выберите кузов",
  }),
  drivetrain: z.enum(["fwd", "rwd", "awd"], { message: "Выберите привод" }),
  engineVolume: z
    .number({ message: "Введите объём двигателя" })
    .min(0.1, "Введите объём двигателя"),
  enginePower: z.number({ message: "Введите мощность" }).int().min(1, "Введите мощность"),
  color: z.string().min(1, "Введите цвет"),
  steeringWheel: z.enum(["left", "right"]),
  saleMode: z.enum(["classified", "exchange"]),
  price: z.number({ message: "Введите цену" }).int().min(1, "Введите цену"),
  description: z.string().optional(),
  images: z
    .array(z.object({ url: z.string().url("Некорректная ссылка на фото") }))
    .min(1, "Добавьте хотя бы одно фото")
    .max(10, "Можно добавить не больше 10 фотографий"),
});

export type ListingFormValues = z.infer<typeof listingSchema>;

// Which fields belong to each wizard step — used to validate only the
// visible step's fields before advancing (see features/listings/ListingForm.tsx).
export const listingStepFields = {
  1: ["make", "model", "year", "mileageKm", "region"],
  2: [
    "transmission",
    "fuelType",
    "bodyType",
    "drivetrain",
    "engineVolume",
    "enginePower",
    "color",
    "steeringWheel",
  ],
  3: ["saleMode", "price", "description", "images"],
} satisfies Record<number, (keyof ListingFormValues)[]>;
