import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Tarifs" };

/** S02 : prix provisoires (replica/schema.sql) ; à fixer avec /replica-launch. */
const PLANS = [
  { code: "grow", name: "Grow", price: 99, year: 891, items: ["30 articles par mois", "1 langue", "1 site", "Audit SEO technique", "WordPress, Webflow, Shopify, webhook"], best: true },
  { code: "scale", name: "Scale", price: 249, year: 2241, items: ["60 articles par mois", "4 langues", "3 sites", "Audit SEO technique", "Accès à l'API"], best: false },
];

export default function Pricing() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-content px-4 py-12 md:px-8">
        <h1 className="text-2xl">Tarifs</h1>
        <p className="mt-2 max-w-reading text-text-muted">3 jours d'essai gratuit. Sans engagement, annulable en un clic. Prix en francs suisses, hors TVA.</p>
        <div className="mt-8 grid max-w-3xl gap-4 md:grid-cols-2">
          {PLANS.map((p) => (
            <section key={p.code} aria-labelledby={`plan-${p.code}`} className={`card ${p.best ? "ring-2 ring-accent" : ""}`}>
              <div className="flex items-start justify-between">
                <h2 id={`plan-${p.code}`} className="text-lg">{p.name}</h2>
                {p.best && <span className="pill bg-accent-soft text-accent">Recommandée</span>}
              </div>
              <p className="mt-2 text-2xl font-bold" aria-label={`${p.price} francs par mois`}>{p.price} CHF <span className="text-sm font-normal text-text-muted">/ mois</span></p>
              <p className="text-xs text-text-muted">ou {p.year} CHF par an (3 mois offerts)</p>
              <ul className="mt-4 space-y-2 text-sm">
                {p.items.map((i) => <li key={i} className="flex gap-2"><Check aria-hidden="true" className="size-4 shrink-0 text-success" />{i}</li>)}
              </ul>
              <Link href="/inscription" className={`${buttonClass(p.best ? "primary" : "secondary")} mt-6 w-full`}>Commencer l'essai</Link>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
