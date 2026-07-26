export type RawSearchParams = Record<string, string | string[] | undefined>;

export function buildHref(
  pathname: string,
  current: RawSearchParams,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => entry && params.append(key, entry));
    } else if (value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getParam(
  searchParams: RawSearchParams,
  key: string,
): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
