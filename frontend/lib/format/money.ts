const tengeFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "KZT",
  maximumFractionDigits: 0,
});

export function formatTenge(value: number): string {
  return tengeFormatter.format(value).replace("KZT", "₸").trim();
}

export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(km)} км`;
}
