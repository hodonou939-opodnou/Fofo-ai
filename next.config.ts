import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Thumbnails of the reference videos on the rhythm pages (served through
    // the app's image optimizer, so visitors don't hit YouTube before a click).
    remotePatterns: [new URL("https://i.ytimg.com/vi/**")],
  },
};

export default nextConfig;
