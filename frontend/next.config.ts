import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles a minimal server + only the node_modules
  // actually used at runtime — see backend/../frontend/Dockerfile's
  // runtime stage, which copies exactly this output instead of shipping
  // the full node_modules tree into the production image.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
