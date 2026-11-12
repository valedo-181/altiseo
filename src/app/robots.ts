import type { MetadataRoute } from "next";
import { PUBLIC_URL } from "@/lib/public-url";

/** Les moteurs lisent le site public ; l'application, la console et les pages techniques leur sont fermées. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/onboarding", "/auth", "/api", "/suspendu", "/design"] }],
    sitemap: `${PUBLIC_URL}/sitemap.xml`,
    host: PUBLIC_URL,
  };
}
