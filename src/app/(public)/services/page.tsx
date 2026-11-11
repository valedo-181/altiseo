import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { ServicesFilm } from "./film";

export const metadata: Metadata = {
  title: "Nos services",
  description: "Ce qu'Altiseo fait pour votre blog, étape par étape : lecture de votre site, un mois de sujets, un article par jour, publication sur votre site, audit SEO.",
};

/** Page des services, en mode sombre quel que soit le réglage de l'appareil (ambiance « film »). */
export default function Services() {
  return (
    <div data-theme="dark" className="bg-bg text-text">
      <PublicHeader />
      <ServicesFilm />
    </div>
  );
}
