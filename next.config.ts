import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Pilots tab folded into the Roster; old links land there.
  async redirects() {
    return [{ source: "/pilots", destination: "/roster", permanent: false }];
  },
};

export default nextConfig;
