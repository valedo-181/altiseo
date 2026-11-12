import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, PUBLIC_URL } from "@/lib/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({ url: `${PUBLIC_URL}${path === "/" ? "" : path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : path === "/connexion" ? 0.3 : 0.7 }));
}
