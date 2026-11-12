import type { Metadata, Viewport } from "next";
import { PUBLIC_URL } from "@/lib/public-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "Altiseo", template: "%s · Altiseo" },
  description: "Des articles SEO écrits, planifiés et publiés pour vous, chaque jour.",
  applicationName: "Altiseo",
  openGraph: { type: "website", siteName: "Altiseo", locale: "fr_CH", images: [{ url: "/brand/sommet.jpg", width: 1344, height: 752, alt: "Un sommet alpin de nuit, parcouru de courbes de niveau lumineuses" }] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#071a2b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
