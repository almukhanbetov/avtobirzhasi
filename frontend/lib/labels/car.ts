import type {
  BodyType,
  Drivetrain,
  FuelType,
  SteeringWheel,
  Transmission,
} from "@/types/car";

export const transmissionLabels: Record<Transmission, string> = {
  automatic: "Автомат",
  manual: "Механика",
};

export const fuelTypeLabels: Record<FuelType, string> = {
  petrol: "Бензин",
  diesel: "Дизель",
  hybrid: "Гибрид",
  electric: "Электро",
  gas: "Газ",
};

export const bodyTypeLabels: Record<BodyType, string> = {
  sedan: "Седан",
  suv: "Внедорожник",
  crossover: "Кроссовер",
  hatchback: "Хэтчбек",
  coupe: "Купе",
  universal: "Универсал",
};

export const drivetrainLabels: Record<Drivetrain, string> = {
  fwd: "Передний",
  rwd: "Задний",
  awd: "Полный",
};

export const steeringWheelLabels: Record<SteeringWheel, string> = {
  left: "Левый",
  right: "Правый",
};
