import type { MetadataRoute } from "next";
import { LEGAL_PAGES, legalReady } from "@/lib/legal";
import { PUBLIC_PAGES, PUBLIC_URL } from "@/lib/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [...PUBLIC_PAGES, ...(legalReady ? LEGAL_PAGES.map(([href]) => href) : [])];
  return pages.map((path) => ({ url: `${PUBLIC_URL}${path === "/" ? "" : path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : path === "/connexion" || !(PUBLIC_PAGES as readonly string[]).includes(path) ? 0.3 : 0.7 }));
}
