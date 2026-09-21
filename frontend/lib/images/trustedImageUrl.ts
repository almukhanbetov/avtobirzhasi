interface TrustedImagePattern {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathnamePrefix?: string;
}

// The backend's own configured origin — NEXT_PUBLIC_API_URL minus the
// "/api" suffix — is where it also serves /uploads/* from (same router,
// see backend/internal/handlers/uploads.go). Used below both to build
// the local pattern's port (never a hardcoded one — see next.config.ts's
// matching localUploadsPort(), which this mirrors) and, in
// resolveImageUrl, to repair an old /uploads/ URL stored when the
// backend ran on a different local port than it does now (Step 2,
// "Восстановление настоящих фотографий").
function configuredApiOrigin(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

function localUploadsPort(): string {
  const origin = configuredApiOrigin();
  if (!origin) return "8080";
  const { hostname, port } = new URL(origin);
  return hostname === "localhost" && port ? port : "8080";
}

// Mirrors next.config.js's images.remotePatterns exactly — keep the two
// lists in sync. next/image throws a hard, page-crashing runtime error
// for any src whose host isn't in that allowlist (Stage 8Б-4: a handful
// of pre-existing local dev listings carry leftover
// https://example.com/*.jpg placeholder photos from manual/E2E testing
// that predates this feature). CarCard checks a URL against this list
// before handing it to next/image, so an untrusted or malformed URL
// falls back safely instead of crashing the page — never by widening
// next.config.js's real allowlist.
const TRUSTED_IMAGE_PATTERNS: TrustedImagePattern[] = [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "http", hostname: "localhost", port: localUploadsPort(), pathnamePrefix: "/uploads/" },
  { protocol: "https", hostname: "api.avtobirzhasi.kz", pathnamePrefix: "/uploads/" },
];

export function isTrustedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return TRUSTED_IMAGE_PATTERNS.some((pattern) => {
    if (parsed.protocol !== `${pattern.protocol}:`) return false;
    if (parsed.hostname !== pattern.hostname) return false;
    if (pattern.port !== undefined && parsed.port !== pattern.port) return false;
    if (pattern.pathnamePrefix && !parsed.pathname.startsWith(pattern.pathnamePrefix)) return false;
    return true;
  });
}

// A locally-uploaded listing photo's URL is always same-origin with the
// backend the frontend itself is configured to talk to (NEXT_PUBLIC_API_
// URL) — that's the same router that wrote the file and that serves it
// back (uploads.go). In local dev, that origin can drift from what was
// stored at upload time if the backend later started on a different
// port (this sandboxed session's :8081 vs config.go's :8080 default —
// Step 2). Rewriting only *that* mismatch to the CURRENT configured
// origin restores the real photo instead of the CarCard placeholder,
// without touching the stored value, the database, or any other kind of
// URL (Unsplash and the production api.avtobirzhasi.kz host are never
// "localhost", so this never touches them).
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== "localhost" || !parsed.pathname.startsWith("/uploads/")) {
    return url;
  }

  const currentOrigin = configuredApiOrigin();
  if (!currentOrigin || parsed.origin === currentOrigin) return url;

  const target = new URL(currentOrigin);
  parsed.protocol = target.protocol;
  parsed.hostname = target.hostname;
  parsed.port = target.port;
  return parsed.toString();
}
