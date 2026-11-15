/**
 * Évolution des positions dans le temps, à partir des mesures hebdomadaires. Fonctions pures,
 * testées dans rank.test.ts. Une mesure en erreur ne compte pas ; « pas dans les 50 premiers »
 * donne un trou dans la courbe du mot-clé (pas un zéro, qui se lirait comme la meilleure place).
 */
import type { RankCheck } from "../domain/types.ts";
import { summarize } from "./serp.ts";

export type TrendPoint = { week: string; measured: number; top3: number; top10: number; average: number | null };
export type SeriesPoint = { day: string; value: number | null };

/** Par semaine (de la plus ancienne à la plus récente) : mots-clés dans le top 3, le top 10, position moyenne. */
export function rankTrend(weeks: string[], checks: RankCheck[], trackedIds: Set<string>): TrendPoint[] {
  return [...weeks].sort().map((week) => {
    const ok = checks.filter((c) => c.week === week && c.status === "ok" && trackedIds.has(c.keywordId));
    const s = summarize(ok.map((c) => c.position));
    return { week, measured: ok.length, top3: s.top3, top10: s.top10, average: s.average };
  });
}

/** La place d'un mot-clé semaine après semaine. Semaine non mesurée, en erreur ou hors classement : pas de point. */
export function keywordSeries(weeks: string[], checks: RankCheck[], keywordId: string): SeriesPoint[] {
  const mine = new Map(checks.filter((c) => c.keywordId === keywordId && c.status === "ok").map((c) => [c.week, c.position]));
  return [...weeks].sort().map((week) => ({ day: week, value: mine.get(week) ?? null }));
}

/** Meilleure place atteinte et écart entre la première et la dernière mesure classée (positif = monté). */
export function seriesSummary(points: SeriesPoint[]): { best: number | null; gain: number | null; ranked: number } {
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  return { best: vals.length ? Math.min(...vals) : null, gain: vals.length >= 2 ? vals[0] - vals[vals.length - 1] : null, ranked: vals.length };
}

/** Tracé d'une mini-courbe (place 1 en haut). Les trous coupent le trait ; un point isolé est rendu par un petit segment. */
export function sparkPath(points: SeriesPoint[], width: number, height: number, worst = 50): string {
  if (!points.length) return "";
  const pad = 2, n = points.length;
  const x = (i: number) => pad + (n > 1 ? (i / (n - 1)) * (width - pad * 2) : (width - pad * 2) / 2);
  const y = (v: number) => pad + ((Math.min(v, worst) - 1) / (worst - 1)) * (height - pad * 2);
  let d = "", open = false;
  points.forEach((p, i) => {
    if (p.value == null) { open = false; return; }
    const px = +x(i).toFixed(1), py = +y(p.value).toFixed(1);
    const alone = !open && (i === n - 1 || points[i + 1].value == null);
    d += alone ? `M${px - 1},${py}L${px + 1},${py}` : `${open ? "L" : "M"}${px},${py}`;
    open = !alone;
  });
  return d;
}
