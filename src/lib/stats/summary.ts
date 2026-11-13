import type { StatsDay, StatsDim, StatsKind } from "@/lib/domain/types";

/** Calculs de la page Statistiques (sans base) : jours manquants, totaux, écarts, classements. Testé dans stats.test.ts. */

const nextDay = (day: string) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const periodOf = (raw: string | undefined): Period => (PERIODS as readonly number[]).includes(Number(raw)) ? (Number(raw) as Period) : 30;

/** Tous les jours de from à to (compris), à zéro quand il n'y a rien. */
export function fillDays(days: StatsDay[], from: string, to: string): StatsDay[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const out: StatsDay[] = [];
  for (let d = from; d <= to; d = nextDay(d)) out.push(by.get(d) ?? { day: d, visitors: 0, pageviews: 0 });
  return out;
}

export type Totals = { visitors: number; pageviews: number; perVisitor: number | null };
export function totals(days: StatsDay[]): Totals {
  const visitors = days.reduce((a, d) => a + d.visitors, 0);
  const pageviews = days.reduce((a, d) => a + d.pageviews, 0);
  return { visitors, pageviews, perVisitor: visitors ? Math.round((pageviews / visitors) * 10) / 10 : null };
}

/** Écart en % avec la période d'avant (null si rien avant). */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}

export type TopRow = { value: string; count: number; share: number };
/** Les n premiers d'un détail sur la période : pages par pages vues, le reste par visiteurs. */
export function top(dims: StatsDim[], kind: StatsKind, n = 8): TopRow[] {
  const by = new Map<string, number>();
  for (const d of dims) if (d.kind === kind) by.set(d.value, (by.get(d.value) ?? 0) + (kind === "page" ? d.pageviews : d.visitors));
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  return [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n)
    .map(([value, count]) => ({ value, count, share: total ? Math.round((count / total) * 100) : 0 }));
}

const COUNTRIES = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["fr"], { type: "region" }) : null;
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "Inconnu";
  try { return COUNTRIES?.of(code) ?? code; } catch { return code; }
}

/** Le plus grand nombre d'une série (au moins 1, pour la hauteur des barres). */
export const peak = (days: StatsDay[]) => Math.max(1, ...days.map((d) => d.visitors));

/** Le site a-t-il envoyé quelque chose ces dernières 48 heures ? */
export const receiving = (lastHitAt: string | null, now = new Date()) => Boolean(lastHitAt && now.getTime() - new Date(lastHitAt).getTime() < 48 * 3_600_000);
