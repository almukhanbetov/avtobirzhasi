import type { NextConfig } from "next";

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
        port: "8080",
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
