"use client";
import { useState } from "react";
import { LineChart } from "@/components/charts/line-chart";
import type { SearchDay } from "@/lib/domain/types";

const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const RANGES = [[28, "28 jours"], [90, "90 jours"]] as const;
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n > 1 ? many : one}`;

/** Les trois courbes (une mesure par graphique, jamais deux échelles sur le même) et leur tableau. */
export function SearchCharts({ days }: { days: SearchDay[] }) {
  const [range, setRange] = useState<number>(90);
  const slice = days.slice(-range);
  return (
    <section aria-labelledby="h-evolution" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="h-evolution" className="text-lg">Évolution</h2>
        <div role="group" aria-label="Période affichée" className="flex gap-1 rounded-md border border-border bg-bg p-1 text-sm">
          {RANGES.map(([n, label]) => (
            <button key={n} type="button" aria-pressed={range === n} onClick={() => setRange(n)}
              className={`h-8 rounded px-3 font-medium transition-colors duration-fast ${range === n ? "bg-accent-soft text-accent" : "text-text-muted hover:text-text"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <LineChart title="Clics par jour" points={slice.map((d) => ({ day: d.day, value: d.clicks }))} unit={(n) => plural(n, "clic", "clics")} />
        <LineChart title="Affichages par jour" points={slice.map((d) => ({ day: d.day, value: d.impressions }))} unit={(n) => plural(n, "affichage", "affichages")} />
        <LineChart title="Position moyenne" note="Plus la courbe est haute, mieux c'est" invert points={slice.map((d) => ({ day: d.day, value: d.position }))} unit={(n) => `Position ${nf.format(n)}`} />
      </div>
      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold">Chiffres jour par jour</summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-bg text-xs text-text-muted">
              <tr><th scope="col" className="py-2 pr-4 font-semibold">Jour</th><th scope="col" className="py-2 pr-4 text-right font-semibold">Clics</th><th scope="col" className="py-2 pr-4 text-right font-semibold">Affichages</th><th scope="col" className="py-2 text-right font-semibold">Position</th></tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {[...slice].reverse().map((d) => (
                <tr key={d.day}><th scope="row" className="py-1.5 pr-4 font-normal">{dayFmt.format(new Date(`${d.day}T12:00:00Z`))}</th><td className="py-1.5 pr-4 text-right">{nf.format(d.clicks)}</td><td className="py-1.5 pr-4 text-right">{nf.format(d.impressions)}</td><td className="py-1.5 text-right">{d.position == null ? "—" : nf.format(d.position)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
