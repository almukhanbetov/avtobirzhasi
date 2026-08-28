const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ApiError carries the backend's { error: { code, message } } envelope so
// callers can branch on `code` (e.g. "FORBIDDEN") instead of parsing text,
// while `message` is already the human-readable Russian string the backend
// produced for display.
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  // A plain object is JSON-encoded. A FormData is sent as-is so the
  // browser sets its own multipart/form-data Content-Type with a
  // boundary — used by the listing-photo upload (see lib/api/uploads.ts).
  body?: unknown;
  token?: string | null;
}

async function request<T>(
  baseUrl: string,
  path: string,
  options: ApiFetchOptions,
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {};
  if (options.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.body === undefined) {
    body = undefined;
  } else if (isFormData) {
    body = options.body as FormData;
  } else {
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Не удалось связаться с сервером. Проверьте подключение к интернету.");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const code = data?.error?.code ?? "UNKNOWN_ERROR";
    const message = data?.error?.message ?? "Что-то пошло не так, попробуйте позже.";
    throw new ApiError(res.status, code, message);
  }

  return data as T;
}

// apiFetch is the single place every backend call goes through — see
// nextjs-frontend-architecture skill's "Centralize backend calls" rule.
// Works from both Server Components (no token, public endpoints) and
// Client Components (token from the auth session).
export function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  return request<T>(API_BASE_URL, path, options);
}
