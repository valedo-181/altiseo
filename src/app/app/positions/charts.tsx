"use client";
import { useState } from "react";
import { LineChart } from "@/components/charts/line-chart";
import type { SeriesPoint, TrendPoint } from "@/lib/rank/history";

type Keyword = { id: string; phrase: string; series: SeriesPoint[]; best: number | null; gain: number | null };
const nf = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const HINT = "Les mêmes chiffres sont dans le tableau « Vos positions ».";

/**
 * Évolution des positions : deux courbes d'ensemble (une mesure par graphique), puis la courbe du
 * mot-clé choisi. La place 1 est en haut : une courbe qui monte est une bonne nouvelle.
 */
export function PositionCharts({ trend, keywords, depth }: { trend: TrendPoint[]; keywords: Keyword[]; depth: number }) {
  const [id, setId] = useState(keywords[0]?.id ?? "");
  const k = keywords.find((x) => x.id === id) ?? keywords[0];
  return (
    <section aria-labelledby="h-trend" className="space-y-4">
      <div>
        <h2 id="h-trend" className="text-lg">Évolution</h2>
        <p className="text-sm text-text-muted">Semaine après semaine, sur {trend.length} semaine{trend.length > 1 ? "s" : ""} de mesures. Passez la souris ou le doigt sur une courbe pour lire la valeur.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title="Mots-clés sur la 1re page (top 10)" tableHint={HINT} points={trend.map((t) => ({ day: t.week, value: t.measured ? t.top10 : null }))} unit={(n) => `${nf.format(n)} mot${n > 1 ? "s" : ""}-clé${n > 1 ? "s" : ""}`} />
        <LineChart title="Position moyenne" note="Plus la courbe est haute, mieux c'est" tableHint={HINT} invert points={trend.map((t) => ({ day: t.week, value: t.average }))} unit={(n) => `Position ${nf.format(n)}`} />
      </div>
      {k && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="kw" className="block text-sm font-semibold">Suivre un mot-clé</label>
              <select id="kw" value={k.id} onChange={(e) => setId(e.target.value)} className="field w-72 max-w-full">
                {keywords.map((x) => <option key={x.id} value={x.id}>{x.phrase}</option>)}
              </select>
            </div>
            <p className="pb-2 text-sm text-text-muted" aria-live="polite">
              {k.best == null ? `Pas encore classé dans les ${depth} premiers.` : <>Meilleure place : <strong className="font-semibold text-text">{k.best}</strong>{k.gain != null && k.gain !== 0 ? <>, {k.gain > 0 ? "monté" : "descendu"} de <strong className="font-semibold text-text">{Math.abs(k.gain)}</strong> place{Math.abs(k.gain) > 1 ? "s" : ""} depuis le début</> : null}.</>}
            </p>
          </div>
          <LineChart title={`« ${k.phrase} »`} note={`Une semaine sans point : pas dans les ${depth} premiers, ou pas mesurée`} tableHint={HINT} invert points={k.series} unit={(n) => `Position ${nf.format(n)}`} />
        </div>
      )}
    </section>
  );
}
