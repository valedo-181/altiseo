"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export type Plan = { code: string; name: string; tagline: string; month: number; year: number; items: string[]; best: boolean };

const chf = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Choix mensuel / annuel et les offres. L'offre recommandée porte un liseré lumineux. */
export function Plans({ plans }: { plans: Plan[] }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <div role="group" aria-label="Période de facturation" className="mx-auto flex w-fit items-center gap-1 rounded-pill border border-border bg-surface p-1 text-sm">
        {[[false, "Mensuel"], [true, "Annuel"]].map(([v, label]) => (
          <button key={label as string} type="button" aria-pressed={yearly === v} onClick={() => setYearly(v as boolean)}
            className={`h-10 rounded-pill px-5 font-semibold transition-colors duration-fast ${yearly === v ? "bg-accent text-on-accent" : "text-text-muted hover:text-text"}`}>
            {label}{v ? <span className={`ml-2 rounded-pill px-2 py-0.5 text-xs ${yearly ? "bg-bg/20" : "bg-highlight/15 text-highlight"}`}>3 mois offerts</span> : null}
          </button>
        ))}
      </div>

      <div className={`mx-auto mt-10 grid gap-6 md:grid-cols-2 ${plans.length > 2 ? "max-w-6xl lg:grid-cols-3" : "max-w-4xl"}`}>
        {plans.map((p) => {
          const perMonth = yearly ? p.year / 12 : p.month;
          return (
            <section key={p.code} aria-labelledby={`plan-${p.code}`} className={`plan min-w-0 ${p.best ? "plan-best" : ""}`}>
              <div className="relative flex h-full flex-col rounded-[15px] bg-surface p-7 md:p-8">
                <div className="flex items-start justify-between gap-3">
                  <h2 id={`plan-${p.code}`} className="font-display text-xl font-medium">{p.name}</h2>
                  {p.best && <span className="pill bg-accent-soft text-accent">Recommandée</span>}
                </div>
                <p className="mt-2 text-text-muted">{p.tagline}</p>
                <p className="mt-7 flex items-baseline gap-2" aria-live="polite">
                  <span className="font-display text-[44px] font-medium leading-none tracking-tight md:text-[56px]">{chf(perMonth)}</span>
                  <span className="text-text-muted">CHF par mois</span>
                </p>
                <p className="mt-2 min-h-5 text-sm text-text-muted">
                  {yearly ? <>Facturé {p.year} CHF par an, au lieu de {p.month * 12} CHF</> : <>Sans engagement, annulable à tout moment</>}
                </p>
                <Link href="/inscription" className={`${buttonClass(p.best ? "primary" : "secondary", "lg")} mt-7 w-full`}>Essayer 3 jours gratuitement</Link>
                <p className="mt-3 text-center text-xs text-text-muted">Sans carte bancaire</p>
                <ul className="mt-7 space-y-3 border-t border-border pt-7">
                  {p.items.map((i) => <li key={i} className="flex gap-3"><Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent" />{i}</li>)}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
