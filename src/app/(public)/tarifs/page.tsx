import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { RevealScope } from "@/components/home/reveal";
import { Plans, type Plan } from "@/components/pricing/plans";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Tarifs",
  description: "Deux offres Altiseo en francs suisses : Grow à 99 CHF et Scale à 249 CHF par mois. Essai gratuit de 3 jours, sans carte bancaire.",
};

/** S02 : prix provisoires (supabase/migrations) ; à fixer avec /replica-launch. */
const PLANS: Plan[] = [
  { code: "grow", name: "Grow", tagline: "Pour faire vivre le blog d'un site.", month: 99, year: 891, best: true,
    items: ["30 articles par mois", "1 site", "1 langue", "Calendrier de 30 sujets", "Audit SEO technique", "Visibilité IA : 10 questions (ChatGPT, Perplexity)", "Positions Google : 50 mots-clés", "Envoi sur WordPress"] },
  { code: "scale", name: "Scale", tagline: "Pour plusieurs sites ou plusieurs langues.", month: 249, year: 2241, best: false,
    items: ["60 articles par mois", "3 sites", "4 langues", "Calendrier de 30 sujets par site", "Audit SEO technique", "Visibilité IA : 30 questions par site (4 IA)", "Positions Google : 200 mots-clés par site", "Envoi sur WordPress"] },
];

const ROWS: [string, string | boolean, string | boolean][] = [
  ["Articles par mois", "30", "60"],
  ["Sites", "1", "3"],
  ["Langues (français, allemand, italien, anglais)", "1", "4"],
  ["Calendrier de sujets à valider", true, true],
  ["Visibilité IA : questions suivies chaque semaine", "10", "30 par site"],
  ["IA interrogées", "ChatGPT, Perplexity", "ChatGPT, Gemini, Perplexity, Claude"],
  ["Positions Google : mots-clés suivis chaque semaine", "50", "200 par site"],
  ["Indexation : état Google des pages + IndexNow (Bing…)", true, true],
  ["Gardien du site : pannes, certificat SSL, nom de domaine", true, true],
  ["Vos consignes de ton appliquées à chaque article", true, true],
  ["Relecture et correction avant publication", true, true],
  ["Envoi sur WordPress, en brouillon ou publié", true, true],
  ["Audit SEO technique noté sur 100", true, true],
];

const INCLUDED = [
  ["3 jours d'essai", "Sans carte bancaire. Vos trente premiers sujets arrivent en une minute."],
  ["Sans engagement", "Vous arrêtez quand vous voulez. Vos articles restent à vous."],
  ["Vous gardez la main", "Chaque article arrive en brouillon. Rien ne paraît sans votre accord."],
];

const FAQ = [
  ["Dois-je donner ma carte bancaire pour l'essai ?", "Non. L'essai de 3 jours se fait sans carte. Vous choisissez une offre seulement si vous voulez continuer."],
  ["Puis-je changer d'offre ou arrêter ?", "Oui, à tout moment. Il n'y a pas de durée minimale en formule mensuelle."],
  ["Que comprend la formule annuelle ?", "Les mêmes services. Vous payez neuf mois au lieu de douze : 891 CHF par an pour Grow, 2241 CHF pour Scale."],
  ["Les prix comprennent-ils la TVA ?", "Non, les prix sont indiqués en francs suisses, hors TVA."],
  ["Que deviennent mes articles si j'arrête ?", "Ceux déjà envoyés sur votre site y restent : ils sont à vous."],
];

const H2 = "font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]";

function Cell({ v, plan }: { v: string | boolean; plan: string }) {
  if (v === true) return <><Check aria-hidden="true" className="mx-auto size-5 text-accent" /><span className="sr-only">Compris dans {plan}</span></>;
  if (v === false) return <><Minus aria-hidden="true" className="mx-auto size-5 text-text-muted" /><span className="sr-only">Non compris dans {plan}</span></>;
  return <span className="font-display text-lg font-medium">{v}</span>;
}

/** S02 : tarifs. Toujours sombre, comme l'accueil. */
export default function Pricing() {
  return (
    <div data-theme="dark" className="bg-bg text-text">
      <RevealScope>
        <section className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/sommet.jpg" alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover object-[70%_30%] opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/85 to-bg" aria-hidden="true" />
          <div className="pricing-glow absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />
          <div className="relative"><PublicHeader /></div>
          <div className="scene is-in relative mx-auto max-w-content px-4 pb-20 pt-14 md:px-8 md:pt-20">
            <div>
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-sm font-semibold text-accent">Tarifs</p>
                <h1 className="mt-4 text-[34px] leading-[1.08] md:text-[56px]">Un prix clair pour chaque étape de la montée.</h1>
                <p className="mx-auto mt-5 max-w-xl text-lg !font-normal leading-relaxed text-text-muted">Essayez 3 jours gratuitement. Ensuite, deux offres en francs suisses, sans engagement.</p>
              </div>
              <div className="mt-10"><Plans plans={PLANS} /></div>
              <p className="mt-6 text-center text-sm text-text-muted">Prix hors TVA.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="h-included" className="scene mx-auto max-w-content px-4 py-20 md:px-8">
          <div>
            <h2 id="h-included" className={H2}>Dans les deux offres</h2>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {INCLUDED.map(([t, d], i) => (
                <li key={t} className="border-t border-border pt-5">
                  <span className="font-display text-sm font-medium text-highlight">0{i + 1}</span>
                  <h3 className="mt-2 text-lg">{t}</h3>
                  <p className="mt-2 text-text-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="h-compare" className="scene mx-auto max-w-content px-4 py-20 md:px-8">
          <div>
            <h2 id="h-compare" className={H2}>Comparer les offres</h2>
            <div className="mt-10 overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border text-sm">
                    <th scope="col" className="px-4 py-4 font-semibold text-text-muted md:px-6"><span className="sr-only">Service</span></th>
                    <th scope="col" className="w-20 px-2 py-4 text-center font-display font-medium text-accent md:w-36">Grow</th>
                    <th scope="col" className="w-20 px-2 py-4 text-center font-display font-medium md:w-36">Scale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ROWS.map(([label, g, s]) => (
                    <tr key={label}>
                      <th scope="row" className="px-4 py-4 font-normal md:px-6">{label}</th>
                      <td className="bg-accent/5 px-2 py-4 text-center"><Cell v={g} plan="Grow" /></td>
                      <td className="px-2 py-4 text-center"><Cell v={s} plan="Scale" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-text-muted">Webflow, Shopify et les sites faits sur mesure sont en préparation.</p>
          </div>
        </section>

        <section aria-labelledby="h-faq" className="scene mx-auto max-w-content px-4 py-20 md:px-8">
          <div className="max-w-3xl">
            <h2 id="h-faq" className={H2}>Questions sur les prix</h2>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{q}<span aria-hidden="true" className="text-accent transition-transform duration-base group-open:rotate-45">+</span></summary>
                  <p className="mt-3 max-w-reading text-text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="scene mx-auto max-w-content px-4 pb-24 pt-6 md:px-8">
          <div className="plan plan-best">
            <div className="relative overflow-hidden rounded-[15px] bg-surface px-6 py-14 text-center md:px-12">
              <div className="pricing-glow absolute inset-0" aria-hidden="true" />
              <div className="relative">
                <h2 className={H2}>Trente sujets dès aujourd'hui, gratuitement</h2>
                <p className="mx-auto mt-4 max-w-xl text-lg font-normal text-text-muted">Donnez l'adresse de votre site et voyez ce qu'Altiseo propose, avant de choisir une offre.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
                  <Link href="/services" className={buttonClass("secondary", "lg")}>Voir comment ça marche</Link>
                </div>
                <p className="mt-4 text-sm text-text-muted">Sans carte bancaire.</p>
              </div>
            </div>
          </div>
        </section>
      </RevealScope>
      <SiteFooter />
    </div>
  );
}
