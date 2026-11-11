/**
 * Des lignes de Google Search Console au rapport affiché : totaux par jour, période en cours contre
 * période précédente, et tableau des recherches. Fonctions pures, testées dans report.test.ts.
 * La position moyenne se pondère par les affichages (comme le fait Google), jamais en moyenne simple.
 */
import { addDays } from "../domain/dates.ts";
import type { SearchDay, SearchQuery, SearchReport, SearchTotals } from "../domain/types.ts";

export type DayRow = { day: string; clicks: number; impressions: number; position: number };
export type QueryRow = DayRow & { query: string };

export const PERIOD_DAYS = 28;
export const CHART_DAYS = 90;
export const MAX_QUERIES = 200;

type Acc = { clicks: number; impressions: number; weighted: number };
const acc = (): Acc => ({ clicks: 0, impressions: 0, weighted: 0 });
function add(a: Acc, r: DayRow) {
  a.clicks += r.clicks;
  a.impressions += r.impressions;
  a.weighted += r.position * r.impressions;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const pos = (a: Acc): number | null => (a.impressions > 0 ? round1(a.weighted / a.impressions) : null);
const totals = (a: Acc): SearchTotals => ({ clicks: a.clicks, impressions: a.impressions, position: pos(a) });

/**
 * `today` sert seulement quand Google n'a encore rien renvoyé (site tout neuf) : le graphique reste
 * alors vide mais daté. Sinon tout s'ancre sur le dernier jour que Google connaît (2 à 3 jours de retard).
 */
export function buildReport(dayRows: DayRow[], queryRows: QueryRow[], today: string): SearchReport {
  const to = dayRows.reduce((m, r) => (r.day > m ? r.day : m), "") || addDays(today, -3);
  const from = addDays(to, -(CHART_DAYS - 1));
  const curFrom = addDays(to, -(PERIOD_DAYS - 1));
  const prevFrom = addDays(curFrom, -PERIOD_DAYS);

  const byDay = new Map(dayRows.map((r) => [r.day, r]));
  const days: SearchDay[] = [];
  const cur = acc(), prev = acc();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = byDay.get(d);
    days.push({ day: d, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0, position: r && r.impressions > 0 ? round1(r.position) : null });
    if (!r) continue;
    if (d >= curFrom) add(cur, r);
    else if (d >= prevFrom) add(prev, r);
  }

  const per = new Map<string, { cur: Acc; prev: Acc }>();
  for (const r of queryRows) {
    if (r.day > to || r.day < prevFrom) continue;
    const q = r.query.trim().toLowerCase();
    if (!q) continue;
    let e = per.get(q);
    if (!e) per.set(q, (e = { cur: acc(), prev: acc() }));
    add(r.day >= curFrom ? e.cur : e.prev, r);
  }
  const queries: SearchQuery[] = [];
  for (const [query, e] of per) {
    const p = pos(e.cur);
    if (p == null) continue; // disparue sur la période en cours
    queries.push({ query, clicks: e.cur.clicks, impressions: e.cur.impressions, position: p, prevPosition: pos(e.prev), prevClicks: e.prev.clicks });
  }
  queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.query.localeCompare(b.query));

  return { from, to, periodDays: PERIOD_DAYS, days, current: totals(cur), previous: totals(prev), queries: queries.slice(0, MAX_QUERIES) };
}

/** Évolution d'une position : positif = le site est monté (la position a baissé en chiffre). */
export function positionGain(q: Pick<SearchQuery, "position" | "prevPosition">): number | null {
  return q.prevPosition == null ? null : round1(q.prevPosition - q.position);
}

/** Variation en pourcentage, null quand il n'y a pas de base de comparaison. */
export function percentChange(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/** Position d'un mot-clé visé : la recherche identique, sans tenir compte des majuscules et des espaces. */
export function findQuery(queries: SearchQuery[], keyword: string): SearchQuery | null {
  const k = keyword.trim().toLowerCase().replace(/\s+/g, " ");
  return k ? queries.find((q) => q.query.replace(/\s+/g, " ") === k) ?? null : null;
}

/** Choisit, parmi les propriétés du compte Google, celle qui couvre le site. Domaine entier d'abord. */
export function matchProperty(siteUrl: string, properties: Array<{ siteUrl: string; permissionLevel: string }>): string | null {
  const host = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, "");
  const usable = properties.filter((p) => p.permissionLevel !== "siteUnverifiedUser");
  const domains = usable.filter((p) => p.siteUrl.startsWith("sc-domain:")).map((p) => p.siteUrl);
  const covering = domains.filter((d) => { const dom = d.slice(10).toLowerCase(); return host === dom || host.endsWith(`.${dom}`); }).sort((a, b) => b.length - a.length);
  if (covering[0]) return covering[0];
  const prefixes = usable.filter((p) => /^https?:\/\//.test(p.siteUrl));
  const rank = (u: URL) => (u.pathname === "/" ? 0 : 1) + (u.protocol === "https:" ? 0 : 2);
  const same = prefixes
    .map((p) => ({ raw: p.siteUrl, u: new URL(p.siteUrl) }))
    .filter((p) => p.u.hostname.toLowerCase().replace(/^www\./, "") === host && p.u.pathname === "/")
    .sort((a, b) => rank(a.u) - rank(b.u));
  return same[0]?.raw ?? null;
}

/** Chiffres d'exemple (mode démo) : toujours les mêmes pour un site donné, en légère hausse. */
export function sampleRows(seed: string, keywords: string[], today: string): { days: DayRow[]; queries: QueryRow[] } {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)), ((h ^= h >>> 16) >>> 0) / 4294967296);
  const list = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))].slice(0, 14);
  const to = addDays(today, -3);
  const span = CHART_DAYS;
  const base = list.map((_, i) => ({ start: 14 + rnd() * 30, gain: 3 + rnd() * 16, volume: 6 + rnd() * 40, from: i < 9 ? 0 : Math.floor(30 + rnd() * 35) }));
  const days: DayRow[] = [], queries: QueryRow[] = [];
  for (let i = 0; i < span; i++) {
    const day = addDays(to, -(span - 1 - i));
    const t = i / (span - 1);
    const weekend = [6, 7].includes(new Date(`${day}T12:00:00Z`).getUTCDay() || 7) ? 0.7 : 1;
    const a = { clicks: 0, impressions: 0, weighted: 0 };
    list.forEach((query, k) => {
      const b = base[k];
      if (i < b.from) return;
      const position = Math.max(1.2, b.start - b.gain * t + (rnd() - 0.5) * 2.4);
      const impressions = Math.max(1, Math.round(b.volume * (0.6 + t * 0.9) * weekend * (0.8 + rnd() * 0.4)));
      const clicks = Math.round(impressions * Math.min(0.3, 0.9 / position) * (0.6 + rnd() * 0.8));
      const row = { day, query, clicks, impressions, position: Math.round(position * 10) / 10 };
      queries.push(row);
      add(a, row);
    });
    // Google cache une partie des recherches : le total du jour dépasse la somme des recherches visibles.
    const hidden = Math.round(a.impressions * 0.25);
    if (a.impressions) days.push({ day, clicks: a.clicks + Math.round(hidden * 0.03), impressions: a.impressions + hidden, position: Math.round((a.weighted / a.impressions) * 10) / 10 });
  }
  return { days, queries };
}
