import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, Gauge, PenLine } from "lucide-react";
import { HeroVideo } from "@/components/home/hero-video";
import { RevealScope } from "@/components/home/reveal";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { ScoreGauge } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status";

export const metadata: Metadata = { alternates: { canonical: "/" },
  title: "Altiseo : votre blog SEO, écrit et publié pour vous",
  description: "Altiseo prépare vos sujets, écrit un article par jour dans votre ton et l'envoie sur votre site. Vous relisez, vous publiez. Essai gratuit de 3 jours.",
};

const BENEFITS = [
  { Icon: CalendarDays, title: "Un mois de sujets en une minute", text: "Trente idées d'articles tirées de votre activité, chacune avec la recherche Google qu'elle vise. Vous gardez, changez ou sautez." },
  { Icon: PenLine, title: "Un article par jour, dans votre ton", text: "Des textes structurés, avec des liens vers vos autres pages. Vos consignes s'appliquent à chacun, et rien n'est inventé." },
  { Icon: Gauge, title: "Un audit qui dit quoi corriger", text: "Votre site noté sur 100, les problèmes du plus grave au moins grave, et la correction à faire pour chacun." },
];

const STEPS = ["Nous lisons votre site", "Vous validez un mois de sujets", "Un article s'écrit chaque jour", "Vous relisez, il part sur votre site", "L'audit vous dit quoi corriger"];

const FAQ = [
  ["Google pénalise-t-il les articles écrits par une IA ?", "Google juge l'utilité d'un contenu, pas la façon dont il est écrit. Ce qu'il sanctionne, c'est le contenu produit en masse sans valeur. C'est pourquoi Altiseo envoie par défaut chaque article en brouillon : vous le relisez et l'ajustez avant qu'il paraisse."],
  ["Faut-il installer quelque chose sur mon site ?", "Non. Pour WordPress, vous créez un « mot de passe d'application » dans votre profil et vous le collez dans Altiseo. Aucun plugin."],
  ["Avec quels sites cela fonctionne-t-il ?", "WordPress aujourd'hui. Webflow, Shopify et les sites faits sur mesure sont en préparation."],
  ["Dans quelles langues les articles sont-ils écrits ?", "Français, allemand, italien ou anglais. L'offre Grow comprend une langue, l'offre Scale quatre."],
  ["Que se passe-t-il après les 3 jours d'essai ?", "Rien ne vous est facturé sans votre accord : l'essai se fait sans carte bancaire. Vos sujets et vos articles restent à vous."],
];

function Word({ text }: { text: string }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.split(" ").map((w, i) => <span key={i} className="word" style={{ transitionDelay: `${80 + i * 70}ms` }}>{w} </span>)}</span>
    </>
  );
}

/** S01 : page d'accueil. Toujours sombre ; le fond est une vidéo en boucle (image fixe si animations réduites). */
export default function Home() {
  return (
    <div data-theme="dark" className="bg-bg text-text">
      <RevealScope>
        {/* Accroche */}
        <section className="relative flex min-h-dvh flex-col overflow-hidden">
          <HeroVideo />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" aria-hidden="true" />
          <div className="relative"><PublicHeader /></div>
          <div className="scene is-in relative mx-auto flex w-full max-w-content flex-1 items-center px-4 pb-24 pt-10 md:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">Blog SEO pour les PME suisses</p>
              <h1 className="mt-4 text-[38px] leading-[1.05] md:text-[64px]">Votre site monte, article après article.</h1>
              <p className="mt-6 max-w-xl text-lg !font-normal leading-relaxed text-text-muted md:text-xl">Altiseo prépare vos sujets, écrit vos articles et les envoie sur votre site. Vous gardez la main sur chaque texte.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
                <Link href="/services" className={buttonClass("secondary", "lg")}>Voir comment ça marche</Link>
              </div>
              <p className="mt-4 text-sm text-text-muted">Sans carte bancaire. Trente sujets proposés dès aujourd'hui.</p>
            </div>
          </div>
        </section>

        {/* Bénéfices */}
        <section aria-labelledby="h-benefits" className="scene mx-auto max-w-content px-4 py-24 md:px-8">
          <div>
            <h2 id="h-benefits" className="max-w-2xl font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Word text="Un blog qui avance, même quand vous n'avez pas le temps" /></h2>
            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {BENEFITS.map(({ Icon, title, text }) => (
                <li key={title} className="rounded-xl border border-border bg-surface p-6">
                  <Icon aria-hidden="true" className="size-7 text-accent" />
                  <h3 className="mt-5 text-lg">{title}</h3>
                  <p className="mt-2 text-text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Aperçu du produit */}
        <section aria-labelledby="h-product" className="scene mx-auto max-w-content px-4 py-24 md:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="min-w-0">
              <h2 id="h-product" className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Word text="Vous validez. Altiseo écrit. Vous relisez." /></h2>
              <p className="mt-5 text-lg font-normal leading-relaxed text-text-muted">Chaque matin, un article vous attend en brouillon. Vous le corrigez si besoin, puis vous l'envoyez sur votre site d'un clic. Ou vous laissez Altiseo le publier à l'heure que vous avez choisie.</p>
              <ul className="mt-6 space-y-2.5">
                {["Titre et description pour Google, prêts à l'emploi", "Liens vers vos autres pages", "Aucun chiffre, prix ou témoignage inventé"].map((t) => (
                  <li key={t} className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="shot-stage min-w-0">
              <div role="img" aria-label="Aperçu : calendrier de sujets, article en brouillon et note d'audit" className="shot space-y-3">
                <div className="rounded-xl border border-border bg-surface p-4 shadow-pop">
                  <ul className="space-y-2.5 text-sm">
                    {[["Lun 16", "Déménager en hiver : nos conseils", "published"], ["Mar 17", "Garde-meubles : quelle taille choisir ?", "draft"], ["Mer 18", "Comment lire un devis de déménagement ?", "approved"]].map(([d, t, st]) => (
                      <li key={d} className="flex items-center gap-3"><span className="w-12 shrink-0 text-xs text-text-muted">{d}</span><span className="min-w-0 flex-1 truncate font-semibold">{t}</span><StatusPill status={st as "published" | "draft" | "approved"} /></li>
                    ))}
                  </ul>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-xl border border-border bg-surface p-4 shadow-pop">
                    <p className="font-serif text-lg font-semibold leading-snug">Garde-meubles : quelle taille choisir ?</p>
                    <div className="mt-3 space-y-2" aria-hidden="true">{[100, 94, 98, 55].map((w, i) => <div key={i} className="h-2 rounded-pill bg-surface-sunken" style={{ width: `${w}%` }} />)}</div>
                    <p className="mt-3 text-xs text-text-muted">1 520 mots, prêt à relire</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-pop">
                    <ScoreGauge value={86} /><p className="text-sm text-text-muted">Santé SEO<br /><span className="font-semibold text-text">2 points à corriger</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Étapes en bref */}
        <section aria-labelledby="h-steps" className="scene mx-auto max-w-content px-4 py-24 md:px-8">
          <div>
            <h2 id="h-steps" className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Word text="Cinq étapes, du camp de base au sommet" /></h2>
            <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s} className="border-t border-border pt-4">
                  <span className="font-display text-2xl font-medium text-accent">{i + 1}</span>
                  <p className="mt-2 font-semibold">{s}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10"><Link href="/services" className={buttonClass("secondary")}>Suivre l'ascension en détail</Link></p>
          </div>
        </section>

        {/* Tarifs */}
        <section aria-labelledby="h-pricing" className="scene mx-auto max-w-content px-4 py-24 md:px-8">
          <div>
            <h2 id="h-pricing" className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Word text="Deux offres, sans engagement" /></h2>
            <div className="mt-10 grid max-w-3xl gap-5 md:grid-cols-2">
              {[["Grow", "99", "30 articles par mois, 1 langue, 1 site", true], ["Scale", "249", "60 articles par mois, 4 langues, 3 sites", false]].map(([name, price, text, best]) => (
                <div key={name as string} className={`rounded-xl border bg-surface p-6 ${best ? "border-accent" : "border-border"}`}>
                  <div className="flex items-start justify-between"><h3 className="text-lg">{name}</h3>{best && <span className="pill bg-accent-soft text-accent">Recommandée</span>}</div>
                  <p className="mt-3 font-display text-2xl font-medium">{price} CHF <span className="font-sans text-sm font-normal text-text-muted">par mois</span></p>
                  <p className="mt-2 text-sm text-text-muted">{text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-text-muted">Prix hors TVA. <Link href="/tarifs" className="font-semibold text-accent underline underline-offset-2">Voir le détail des offres</Link></p>
          </div>
        </section>

        {/* Questions fréquentes */}
        <section aria-labelledby="h-faq" className="scene mx-auto max-w-content px-4 py-24 md:px-8">
          <div className="max-w-3xl">
            <h2 id="h-faq" className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px] md:leading-[1.12]"><Word text="Questions fréquentes" /></h2>
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

        {/* Dernier appel */}
        <section className="scene mx-auto max-w-content px-4 pb-24 pt-10 md:px-8">
          <div className="rounded-xl border border-border bg-surface px-6 py-14 text-center md:px-12">
            <h2 className="font-display text-2xl font-medium leading-tight tracking-tight md:text-[40px]">Commencez l'ascension aujourd'hui</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg font-normal text-text-muted">Donnez l'adresse de votre site : vos trente premiers sujets arrivent en une minute.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
            </div>
          </div>
        </section>
      </RevealScope>

      <SiteFooter />
    </div>
  );
}
