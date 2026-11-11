import Link from "next/link";
import { CalendarDays, FileCheck2, Gauge, PenLine } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { buttonClass } from "@/components/ui/button";

/** S01 : site vitrine (version de travail ; le vrai texte viendra avec /replica-launch). */
export default function Home() {
  const steps = [
    { Icon: Gauge, title: "Nous lisons votre site", text: "Votre activité, vos clients, vos concurrents : en quelques minutes." },
    { Icon: CalendarDays, title: "Vous validez un mois de sujets", text: "30 idées d'articles choisies pour vos clients. Vous gardez, changez ou sautez." },
    { Icon: PenLine, title: "Un article par jour", text: "Écrit dans votre ton, avec des liens vers vos autres pages." },
    { Icon: FileCheck2, title: "Vous relisez, il part en ligne", text: "En brouillon sur votre site, ou publié directement si vous préférez." },
  ];
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-content px-4 md:px-8">
        <section className="max-w-reading py-16 md:py-24">
          <p className="text-sm font-semibold text-accent">Blog SEO pour PME suisses</p>
          <h1 className="mt-3 text-2xl md:text-display">Votre site monte, article après article.</h1>
          <p className="mt-4 text-lg font-normal text-text-muted">Altiseo prépare vos sujets, écrit vos articles et les publie sur votre site. Vous gardez la main sur chaque texte.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/inscription" className={buttonClass("primary", "lg")}>Essayer 3 jours gratuitement</Link>
            <Link href="/services" className={buttonClass("secondary", "lg")}>Découvrir nos services</Link>
          </div>
        </section>
        <section aria-labelledby="h-how" className="pb-20">
          <h2 id="h-how" className="text-xl">Comment ça marche</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ Icon, title, text }, i) => (
              <li key={title} className="card">
                <Icon aria-hidden="true" className="size-6 text-accent" />
                <p className="mt-3 font-semibold"><span className="text-text-muted">{i + 1}. </span>{title}</p>
                <p className="mt-1 text-sm text-text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
