import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // Script des statistiques, posé sur les sites des clients : gardé un jour par les navigateurs.
    return [{ source: "/s.js", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }, { key: "Access-Control-Allow-Origin", value: "*" }] }];
  },
};

export default config;
