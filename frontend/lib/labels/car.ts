import type {
  BodyType,
  Drivetrain,
  FuelType,
  SteeringWheel,
  Transmission,
} from "@/types/car";
import type { Lang } from "@/lib/i18n/translations";

export const transmissionLabels: Record<Lang, Record<Transmission, string>> = {
  ru: {
    automatic: "Автомат",
    manual: "Механика",
  },
  kz: {
    automatic: "Автомат",
    manual: "Механикалық",
  },
};

export const fuelTypeLabels: Record<Lang, Record<FuelType, string>> = {
  ru: {
    petrol: "Бензин",
    diesel: "Дизель",
    hybrid: "Гибрид",
    electric: "Электро",
    gas: "Газ",
  },
  kz: {
    petrol: "Бензин",
    diesel: "Дизель",
    hybrid: "Гибрид",
    electric: "Электр",
    gas: "Газ",
  },
};

export const bodyTypeLabels: Record<Lang, Record<BodyType, string>> = {
  ru: {
    sedan: "Седан",
    suv: "Внедорожник",
    crossover: "Кроссовер",
    hatchback: "Хэтчбек",
    coupe: "Купе",
    universal: "Универсал",
  },
  kz: {
    sedan: "Седан",
    suv: "Жол талғамайтын көлік",
    crossover: "Кроссовер",
    hatchback: "Хэтчбек",
    coupe: "Купе",
    universal: "Универсал",
  },
};

export const drivetrainLabels: Record<Lang, Record<Drivetrain, string>> = {
  ru: {
    fwd: "Передний",
    rwd: "Задний",
    awd: "Полный",
  },
  kz: {
    fwd: "Алдыңғы",
    rwd: "Артқы",
    awd: "Толық жетек",
  },
};

export const steeringWheelLabels: Record<Lang, Record<SteeringWheel, string>> = {
  ru: {
    left: "Левый",
    right: "Правый",
  },
  kz: {
    left: "Сол жақ",
    right: "Оң жақ",
  },
};
