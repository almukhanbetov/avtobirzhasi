import type { NextConfig } from "next";

// The local dev backend's port is normally 8080 (backend/internal/config
// /config.go's default), but this frontend can be started against a
// backend on a different port when 8080 is already taken on the machine
// (NEXT_PUBLIC_API_URL=http://localhost:8081/api — see
// docs/LOCATION_QA_REPORT.md, "Восстановление настоящих фотографий").
// Uploaded photos are always served from that same origin
// (backend/internal/handlers/uploads.go registers /uploads/:name on the
// same router as /api/*), so the allowed local uploads port is derived
// from NEXT_PUBLIC_API_URL instead of a hardcoded port — falling back to
// the original default, unchanged, whenever that variable isn't set to a
// localhost URL.
function localUploadsPort(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return "8080";
  try {
    const { hostname, port } = new URL(apiUrl);
    return hostname === "localhost" && port ? port : "8080";
  } catch {
    return "8080";
  }
}

const nextConfig: NextConfig = {
  // Standalone output bundles a minimal server + only the node_modules
  // actually used at runtime — see backend/../frontend/Dockerfile's
  // runtime stage, which copies exactly this output instead of shipping
  // the full node_modules tree into the production image.
  output: "standalone",
  images: {
    // In local dev the backend serving uploaded photos is on
    // http://localhost:8080, which resolves to 127.0.0.1 — Next 16's
    // image optimizer blocks private IPs by default (SSRF guard). Allow
    // it in development only; in production the photos come from
    // https://api.avtobirzhasi.kz (a public IP) so the guard stays on.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      // Seller-uploaded listing photos are served by the backend from
      // /uploads/* (see backend/internal/handlers/uploads.go). Local dev
      // hits the API on :8080 directly; production serves them from the
      // api subdomain, reverse-proxied by Caddy.
      {
        protocol: "http",
        hostname: "localhost",
        port: localUploadsPort(),
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "api.avtobirzhasi.kz",
        port: "",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
