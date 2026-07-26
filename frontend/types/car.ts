export type Transmission = "automatic" | "manual";

export type FuelType = "petrol" | "diesel" | "hybrid" | "electric" | "gas";

export type BodyType =
  | "sedan"
  | "suv"
  | "crossover"
  | "hatchback"
  | "coupe"
  | "universal";

export type Drivetrain = "fwd" | "rwd" | "awd";

export type SteeringWheel = "left" | "right";

export type ExchangeRole = "seller" | "buyer";

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number;
  region: string;
  transmission: Transmission;
  fuelType: FuelType;
  bodyType: BodyType;
  drivetrain: Drivetrain;
  engineVolume: number;
  enginePower: number;
  color: string;
  steeringWheel: SteeringWheel;
  imageUrl: string;
  images: string[];
  sellerId: string;
  isExchange?: boolean;
  exchangeRole?: ExchangeRole;
  dailyChangePercent?: number;
}
