import type { Metadata, Viewport } from "next";
import { PUBLIC_URL } from "@/lib/public-url";
import "./globals.css";

/** L'image qui accompagne un lien partagé (WhatsApp, LinkedIn, Facebook, iMessage…) : 1200 × 630, le format attendu. */
const SHARE_IMAGE = { url: "/brand/partage.jpg", width: 1200, height: 630, alt: "Altiseo : soyez trouvé sur Google et dans les IA. Référencement naturel, annonces Google et Meta, visibilité dans ChatGPT. Essai gratuit de 3 jours." };

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: { default: "Altiseo", template: "%s · Altiseo" },
  description: "Référencement naturel, annonces Google et Meta, visibilité dans les IA : Altiseo écrit, publie et mesure pour vous. Essai gratuit de 3 jours.",
  applicationName: "Altiseo",
  openGraph: { type: "website", siteName: "Altiseo", locale: "fr_CH", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
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
