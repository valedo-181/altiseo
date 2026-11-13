/**
 * Positions Google (lot C) : un mot-clé = une recherche Google par semaine, par DataForSEO en direct
 * (« live », réponse en quelques secondes ; environ USD 0.002 à 0.004 la recherche). Identifiants
 * dans DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD, côté serveur seulement.
 * Les fonctions sans réseau (lecture du résultat, écarts, exemples) sont testées dans rank.test.ts.
 */

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type TopResult = { rank: number; title: string; domain: string };
export type RankResult = { position: number | null; url: string | null; top: TopResult[] };

/** Profondeur lue : les 50 premiers résultats (au-delà, « pas dans les 50 premiers »). */
export const DEPTH = 50;
export const PHRASE_MIN = 2, PHRASE_MAX = 120;

/** Mots-clés suivis par offre (même chiffres que la migration 20261117000000). */
export const RANK_PLANS: Record<"grow" | "scale" | "agence", number> = { grow: 50, scale: 200, agence: 100 };

export const dataForSeoConfigured = () => Boolean(process.env.DATAFORSEO_LOGIN?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());

/** Pays de la recherche d'après le domaine (Suisse par défaut : le marché d'Altiseo). Codes DataForSEO. */
const LOCATIONS: Record<string, number> = { ch: 2756, fr: 2250, de: 2276, it: 2380, at: 2040, be: 2056, lu: 2442 };
export function locationOf(host: string): { code: number; country: string } {
  const tld = host.split(".").pop()?.toLowerCase() ?? "";
  return tld in LOCATIONS ? { code: LOCATIONS[tld], country: tld.toUpperCase() } : { code: LOCATIONS.ch, country: "CH" };
}

export const cleanPhrase = (raw: string) => raw.replace(/\s+/g, " ").trim().toLowerCase();

/** Le domaine d'un résultat est-il celui du site (avec ou sans www, sous-domaines compris) ? */
export function sameSite(domain: string | null | undefined, host: string): boolean {
  const d = (domain ?? "").toLowerCase().replace(/^www\./, "");
  const h = host.toLowerCase().replace(/^www\./, "");
  return !!h && !!d && (d === h || d.endsWith("." + h));
}

type Item = { type?: string; rank_group?: number; title?: string; domain?: string; url?: string };

/** Place du site parmi les résultats naturels (annonces et blocs exclus), et les 3 premiers. */
export function findRank(items: Item[], host: string): RankResult {
  const list = items.filter((i) => i.type === "organic" && typeof i.rank_group === "number").sort((a, b) => a.rank_group! - b.rank_group!);
  const hit = list.find((i) => sameSite(i.domain, host));
  return {
    position: hit && hit.rank_group! <= 100 ? hit.rank_group! : null,
    url: hit?.url?.slice(0, 2000) ?? null,
    top: list.slice(0, 3).map((i) => ({ rank: i.rank_group!, title: String(i.title ?? "").slice(0, 120), domain: String(i.domain ?? "").replace(/^www\./, "").slice(0, 120) })),
  };
}

type LiveJson = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: Array<{ items?: Item[] | null }> | null }> };

/** Une recherche Google en direct. Les identifiants n'apparaissent jamais dans les messages d'erreur. */
export async function searchGoogle(f: Fetcher, q: { keyword: string; language: string; location: number; host: string }): Promise<{ ok: true; value: RankResult } | { ok: false; error: string }> {
  const auth = "Basic " + Buffer.from(`${process.env.DATAFORSEO_LOGIN?.trim()}:${process.env.DATAFORSEO_PASSWORD?.trim()}`).toString("base64");
  let res: Response;
  try {
    res = await f("https://api.dataforseo.com/v3/serp/google/organic/live/regular", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify([{ keyword: q.keyword, location_code: q.location, language_code: q.language, depth: DEPTH, device: "desktop" }]),
      signal: AbortSignal.timeout(45_000),
      redirect: "error",
    });
  } catch {
    return { ok: false, error: "DataForSEO ne répond pas." };
  }
  const j = (await res.json().catch(() => null)) as LiveJson | null;
  if (res.status === 401 || j?.status_code === 40100) return { ok: false, error: "Identifiants DataForSEO refusés." };
  if (res.status === 402 || j?.status_code === 40200) return { ok: false, error: "Crédit DataForSEO épuisé." };
  const t = j?.tasks?.[0];
  if (!res.ok || !j || j.status_code !== 20000 || !t) return { ok: false, error: `DataForSEO : ${j?.status_message ?? `erreur ${res.status}`}`.slice(0, 300) };
  if (t.status_code === 40102) return { ok: true, value: { position: null, url: null, top: [] } }; // aucun résultat
  if (t.status_code !== 20000) return { ok: false, error: `DataForSEO : ${t.status_message ?? t.status_code}`.slice(0, 300) };
  return { ok: true, value: findRank(t.result?.[0]?.items ?? [], q.host) };
}

/** Écart avec la semaine d'avant : positif = le site monte. null si l'une des deux manque. */
export function movement(now: number | null, before: number | null | undefined): { kind: "up" | "down" | "same" | "new" | "lost" | "none"; by: number } {
  if (before === undefined) return { kind: "none", by: 0 };
  if (now != null && before == null) return { kind: "new", by: 0 };
  if (now == null && before != null) return { kind: "lost", by: 0 };
  if (now == null || before == null) return { kind: "none", by: 0 };
  return now < before ? { kind: "up", by: before - now } : now > before ? { kind: "down", by: now - before } : { kind: "same", by: 0 };
}

export type RankSummary = { tracked: number; top3: number; top10: number; top50: number; average: number | null };

/** Chiffres du haut de page : combien de mots-clés dans le top 3, le top 10, et la position moyenne des classés. */
export function summarize(positions: Array<number | null>): RankSummary {
  const ranked = positions.filter((p): p is number => p != null);
  return {
    tracked: positions.length,
    top3: ranked.filter((p) => p <= 3).length,
    top10: ranked.filter((p) => p <= 10).length,
    top50: ranked.filter((p) => p <= 50).length,
    average: ranked.length ? Math.round((ranked.reduce((a, b) => a + b, 0) / ranked.length) * 10) / 10 : null,
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Résultat d'exemple (sans DataForSEO) : stable pour un mot-clé et une semaine, qui bouge un peu d'une semaine à l'autre. */
export function sampleRank(keyword: string, week: string, host: string, rivals: string[]): RankResult {
  const base = hash(keyword) % 40; // position « de fond » du mot-clé
  const wiggle = (hash(`${keyword}|${week}`) % 7) - 3;
  const raw = base + 1 + wiggle;
  const position = base > 32 ? null : Math.max(1, raw);
  const pool = [...new Set([...rivals, "exemple-services.ch", "alpha-conseil.ch", "annuaire-local.ch"])].filter((d) => d !== host);
  const top: TopResult[] = [0, 1, 2].map((i) => ({ rank: i + 1, title: `${keyword} – résultat ${i + 1}`, domain: pool[(hash(keyword) + i) % pool.length] }));
  if (position && position <= 3) top[position - 1] = { rank: position, title: keyword, domain: host };
  return { position, url: position ? `https://${host}/` : null, top };
}
