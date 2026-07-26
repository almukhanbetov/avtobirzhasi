import { getParam, type RawSearchParams } from "@/lib/url/searchParams";

export type SortOption = "newest" | "price-asc" | "price-desc" | "year-desc";

export const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Сначала новые" },
  { value: "price-asc", label: "Цена по возрастанию" },
  { value: "price-desc", label: "Цена по убыванию" },
  { value: "year-desc", label: "Год новее" },
];

export interface CarFilters {
  region: string;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  bodyType: string;
  transmission: string;
  drivetrain: string;
  fuelType: string;
  sort: SortOption;
  page: number;
}

function toNumberOrNull(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseCarFilters(searchParams: RawSearchParams): CarFilters {
  const sortParam = getParam(searchParams, "sort");
  const sort = sortOptions.some((option) => option.value === sortParam)
    ? (sortParam as SortOption)
    : "newest";
  const page = Number(getParam(searchParams, "page"));

  return {
    region: getParam(searchParams, "region"),
    make: getParam(searchParams, "make"),
    model: getParam(searchParams, "model").trim(),
    yearFrom: toNumberOrNull(getParam(searchParams, "yearFrom")),
    yearTo: toNumberOrNull(getParam(searchParams, "yearTo")),
    priceFrom: toNumberOrNull(getParam(searchParams, "priceFrom")),
    priceTo: toNumberOrNull(getParam(searchParams, "priceTo")),
    bodyType: getParam(searchParams, "bodyType"),
    transmission: getParam(searchParams, "transmission"),
    drivetrain: getParam(searchParams, "drivetrain"),
    fuelType: getParam(searchParams, "fuelType"),
    sort,
    page: page > 0 ? page : 1,
  };
}

export function countActiveFilters(filters: CarFilters): number {
  return [
    filters.region,
    filters.make,
    filters.model,
    filters.yearFrom,
    filters.yearTo,
    filters.priceFrom,
    filters.priceTo,
    filters.bodyType,
    filters.transmission,
    filters.drivetrain,
    filters.fuelType,
  ].filter(Boolean).length;
}
