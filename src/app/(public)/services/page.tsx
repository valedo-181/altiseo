import type { Metadata } from "next";
import Link from "next/link";
import { FeatureGroups } from "@/components/home/features";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { ServicesFilm } from "./film";

export const metadata: Metadata = { alternates: { canonical: "/services" },
  title: "Nos services",
  description: "Ce qu'Altiseo fait pour votre blog, étape par étape : lecture de votre site, un mois de sujets, un article par jour, publication sur votre site, audit SEO.",
};

/** Page des services, en mode sombre quel que soit le réglage de l'appareil (ambiance « film »). */
export default function Services() {
  return (
    <div data-theme="dark" className="bg-bg text-text">
      <PublicHeader />
      <ServicesFilm />
      <section aria-labelledby="h-more" className="mx-auto max-w-content px-4 pb-24 pt-8 md:px-8">
        <h2 id="h-more" className="max-w-3xl font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]">Et pendant que le blog avance</h2>
        <p className="mt-5 max-w-2xl text-lg font-normal leading-relaxed text-text-muted">Les cinq étapes font vivre votre blog. Ces outils, compris dans toutes les offres, travaillent en plus pour vous.</p>
        <FeatureGroups />
        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
          <Link href="/tarifs" className={buttonClass("secondary", "lg")}>Voir les tarifs</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
