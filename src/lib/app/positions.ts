import "server-only";
import { demoMode } from "@/lib/config";
import { db, QuotaReached } from "@/lib/data/store";
import type { RankKeyword, UrlInspection } from "@/lib/domain/types";
import { hostOf } from "@/lib/geo/analyze";
import { keyFileUrl, keyMatches, parseUrls, submitIndexNow } from "@/lib/rank/indexnow";
import { cleanPhrase, dataForSeoConfigured, locationOf, PHRASE_MAX, PHRASE_MIN, sampleRank, searchGoogle, type Fetcher } from "@/lib/rank/serp";
import { inspectUrl } from "@/lib/search/google";
import { safeFetch } from "@/lib/seo/crawl";
import { thisWeek } from "./geo";
import { googleAccess, type Result } from "./service";

/**
 * Positions Google (DataForSEO, une recherche par mot-clé et par semaine) et indexation : IndexNow
 * pour Bing et les autres moteurs, inspection d'URL Search Console pour Google. Sans DataForSEO (ou
 * en mode démo) : positions d'exemple, marquées comme telles.
 */

const fail = (error: string): Result<never> => ({ ok: false, error });
const PARALLEL = 5;
const IMPORT_AT_ONCE = 10;
const INSPECT_MAX = 20;
const DAY = 86_400_000;

export const positionsLive = () => !demoMode && dataForSeoConfigured();

const quotaText = (max: number) => `Votre offre suit ${max} mots-clés au plus. Retirez-en un ou passez à l'offre supérieure.`;

export async function addRankKeyword(workspaceId: string, siteId: string, raw: string): Promise<Result> {
  const phrase = cleanPhrase(raw);
  if (phrase.length < PHRASE_MIN) return fail("Écrivez un mot-clé d'au moins 2 caractères.");
  if (phrase.length > PHRASE_MAX) return fail(`Le mot-clé est trop long (${PHRASE_MAX} caractères au plus).`);
  const max = await db.rankPlan(workspaceId);
  if (!max) return fail("Votre offre ne comprend pas le suivi des positions.");
  const existing = await db.listRankKeywords(workspaceId, siteId);
  if (existing.some((k) => k.phrase.toLowerCase() === phrase)) return fail("Ce mot-clé est déjà suivi.");
  if (existing.length >= max) return fail(quotaText(max));
  try {
    const n = await db.addRankKeywords(workspaceId, siteId, [{ phrase, source: "manual" }]);
    return n ? { ok: true, value: undefined } : fail(quotaText(max));
  } catch (e) {
    if (e instanceof QuotaReached) return fail(quotaText(max));
    throw e;
  }
}

/**
 * Propose les mots-clés déjà connus : d'abord les recherches qui affichent le site dans Google
 * (Search Console, les plus vues), puis ceux du calendrier. 10 à la fois, jusqu'au quota.
 */
export async function importRankKeywords(workspaceId: string, siteId: string): Promise<Result<number>> {
  const [max, existing, report, calendar] = await Promise.all([
    db.rankPlan(workspaceId), db.listRankKeywords(workspaceId, siteId), db.searchReport(workspaceId, siteId), db.listCalendar(workspaceId, siteId),
  ]);
  if (!max) return fail("Votre offre ne comprend pas le suivi des positions.");
  const room = max - existing.length;
  if (room <= 0) return fail(`Vous suivez déjà ${max} mots-clés, le maximum de votre offre.`);
  const have = new Set(existing.map((k) => k.phrase.toLowerCase()));
  const picks: Array<{ phrase: string; source: RankKeyword["source"] }> = [];
  const take = (raw: string, source: RankKeyword["source"]) => {
    const p = cleanPhrase(raw);
    if (p.length < PHRASE_MIN || p.length > PHRASE_MAX || have.has(p)) return;
    have.add(p);
    picks.push({ phrase: p, source });
  };
  for (const q of [...(report?.queries ?? [])].sort((a, b) => b.impressions - a.impressions)) take(q.query, "search_console");
  for (const c of calendar) if (c.keyword) take(c.keyword, "calendar");
  const list = picks.slice(0, Math.min(room, IMPORT_AT_ONCE));
  if (!list.length) return fail("Pas de mot-clé à reprendre : connectez Search Console (page Mots-clés) ou écrivez vos mots-clés.");
  return { ok: true, value: await db.addRankKeywords(workspaceId, siteId, list) };
}

export type RankRunSummary = { measured: number; errors: number; remaining: number; demo: boolean };

/**
 * Mesure de la semaine pour un site : chaque mot-clé suivi sans mesure de la semaine est cherché sur
 * Google (5 à la fois). Une mesure par mot-clé et par semaine ; un passage interrompu reprend.
 */
export async function runPositions(workspaceId: string, siteId: string, opts: { budgetMs?: number; fetcher?: Fetcher; now?: Date } = {}): Promise<Result<RankRunSummary>> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  const max = await db.rankPlan(workspaceId);
  if (!max) return fail("Votre offre ne comprend pas le suivi des positions.");
  const [site, all, rivals] = await Promise.all([db.getSite(workspaceId, siteId), db.listRankKeywords(workspaceId, siteId), db.listCompetitors(workspaceId, siteId)]);
  const keywords = all.slice(0, max);
  if (!keywords.length) return fail("Ajoutez d'abord les mots-clés à suivre.");
  const week = thisWeek(opts.now);
  const demo = !positionsLive();
  // Une fois DataForSEO branché, les mesures d'exemple de la semaine sont refaites pour de vrai.
  const done = new Set((await db.listRankChecks(workspaceId, siteId, [week])).filter((c) => demo || !c.demo).map((c) => c.keywordId));
  const queue = keywords.filter((k) => !done.has(k.id));
  const sum: RankRunSummary = { measured: 0, errors: 0, remaining: 0, demo };
  if (!queue.length) return fail("Les positions de la semaine sont déjà mesurées. Prochaine mesure lundi.");

  const host = hostOf(site.url) ?? site.url;
  const where = locationOf(host);
  const rivalHosts = rivals.map((c) => hostOf(c.url)).filter((h): h is string => Boolean(h));
  const f: Fetcher = opts.fetcher ?? ((u, i) => fetch(u, i));

  const one = async (k: RankKeyword) => {
    const r = demo ? { ok: true as const, value: sampleRank(k.phrase, week, host, rivalHosts) } : await searchGoogle(f, { keyword: k.phrase, language: site.language, location: where.code, host });
    sum.measured++;
    if (!r.ok) {
      sum.errors++;
      await db.saveRankCheck(workspaceId, siteId, { keywordId: k.id, week, status: "error", position: null, url: null, top: [], error: r.error, demo });
      return;
    }
    await db.saveRankCheck(workspaceId, siteId, { keywordId: k.id, week, status: "ok", position: r.value.position, url: r.value.url, top: r.value.top, error: null, demo });
  };
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > budget) return;
      const k = queue.shift();
      if (!k) return;
      await one(k).catch((e) => { sum.errors++; console.error("positions.keyword", e instanceof Error ? e.message : e); });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  sum.remaining = queue.length;
  return { ok: true, value: sum };
}

// ---------------------------------------------------------------------------
// IndexNow
// ---------------------------------------------------------------------------

/** Le fichier de clé est-il en ligne sur le site ? */
export async function verifyIndexNowKey(workspaceId: string, siteId: string): Promise<Result> {
  const [site, ix] = await Promise.all([db.getSite(workspaceId, siteId), db.indexingOf(workspaceId, siteId)]);
  if (demoMode) {
    await db.saveIndexing(workspaceId, siteId, { keyVerifiedAt: new Date().toISOString(), keyError: null });
    return { ok: true, value: undefined };
  }
  const url = keyFileUrl(site.url, ix.indexnowKey);
  const r = await safeFetch(url, 10_000);
  const error = r.status === 0 ? `Fichier introuvable (${"error" in r ? r.error : "site injoignable"}).`
    : r.status === 404 ? `Le fichier ${url} n'existe pas encore sur le site.`
    : r.status >= 400 ? `Le site répond « erreur ${r.status} » pour ${url}.`
    : !("body" in r) || !keyMatches(r.body, ix.indexnowKey) ? "Le fichier est en ligne, mais il ne contient pas exactement la clé." : null;
  await db.saveIndexing(workspaceId, siteId, error ? { keyError: error, keyVerifiedAt: null } : { keyError: null, keyVerifiedAt: new Date().toISOString() });
  return error ? fail(error) : { ok: true, value: undefined };
}

async function send(workspaceId: string, siteId: string, siteUrl: string, key: string, urls: string[], source: "manual" | "article", f?: Fetcher) {
  if (demoMode) {
    await db.addSubmission(workspaceId, siteId, { urls, source, statusCode: 200, ok: true, error: null, demo: true });
    return { ok: true, message: "Pages signalées (exemple : rien n'est envoyé en mode démo)." };
  }
  const r = await submitIndexNow(f ?? ((u, i) => fetch(u, i)), siteUrl, key, urls);
  await db.addSubmission(workspaceId, siteId, { urls, source, statusCode: r.status || null, ok: r.ok, error: r.ok ? null : r.message, demo: false });
  if (r.status === 403) await db.saveIndexing(workspaceId, siteId, { keyVerifiedAt: null, keyError: r.message });
  return r;
}

/** « Signaler des pages » : adresses collées par la personne (celles du site seulement, 100 au plus). */
export async function submitUrls(workspaceId: string, siteId: string, raw: string, f?: Fetcher): Promise<Result<{ sent: number; rejected: string[]; message: string }>> {
  const [site, ix] = await Promise.all([db.getSite(workspaceId, siteId), db.indexingOf(workspaceId, siteId)]);
  if (!ix.keyVerifiedAt) return fail("Mettez d'abord le fichier de clé en ligne, puis cliquez sur « Vérifier le fichier ».");
  const { urls, rejected } = parseUrls(raw, site.url);
  if (!urls.length) return fail(rejected.length ? `Ces adresses ne sont pas sur ${hostOf(site.url)} : ${rejected.slice(0, 3).join(", ")}.` : "Collez au moins une adresse de votre site.");
  const r = await send(workspaceId, siteId, site.url, ix.indexnowKey, urls, "manual", f);
  return r.ok ? { ok: true, value: { sent: urls.length, rejected, message: r.message } } : fail(r.message);
}

/** Après la publication d'un article : signalé tout de suite si la clé est en ligne et l'envoi automatique actif. Jamais bloquant. */
export async function notifyPublished(workspaceId: string, siteId: string, url: string): Promise<void> {
  try {
    const [site, ix] = await Promise.all([db.getSite(workspaceId, siteId), db.indexingOf(workspaceId, siteId)]);
    if (!ix.keyVerifiedAt || !ix.autoSubmit) return;
    const { urls } = parseUrls(url, site.url);
    if (urls.length) await send(workspaceId, siteId, site.url, ix.indexnowKey, urls, "article");
  } catch (e) {
    console.error("indexnow.article", e instanceof Error ? e.message : e);
  }
}

export async function setAutoSubmit(workspaceId: string, siteId: string, on: boolean): Promise<void> {
  await db.indexingOf(workspaceId, siteId);
  await db.saveIndexing(workspaceId, siteId, { autoSubmit: on });
}

// ---------------------------------------------------------------------------
// Indexation Google (inspection d'URL)
// ---------------------------------------------------------------------------

/** Pages à suivre : l'accueil puis les articles publiés par Altiseo (50 au plus), toutes sur le site. */
export async function trackedPages(workspaceId: string, siteId: string): Promise<string[]> {
  const site = await db.getSite(workspaceId, siteId);
  const host = new URL(site.url).hostname.toLowerCase();
  const out = [new URL(site.url).origin + "/"];
  const published = (await db.listArticles(workspaceId, siteId)).filter((a) => a.status === "published").slice(0, 50);
  const pubs = await Promise.all(published.map((a) => db.publicationOf(workspaceId, a.id)));
  for (const p of pubs) {
    if (!p?.remoteUrl || p.status !== "ok") continue;
    try {
      const u = new URL(p.remoteUrl);
      if (u.hostname.toLowerCase() === host && !out.includes(u.toString())) out.push(u.toString());
    } catch { /* adresse illisible : ignorée */ }
  }
  return out;
}

const VERDICTS: UrlInspection["verdict"][] = ["PASS", "PASS", "PASS", "NEUTRAL", "FAIL"];
function sampleInspection(url: string): Omit<UrlInspection, "id" | "siteId" | "checkedAt"> {
  let h = 0;
  for (const ch of url) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const verdict = VERDICTS[h % VERDICTS.length];
  const coverage = verdict === "PASS" ? "Envoyée et indexée" : verdict === "NEUTRAL" ? "Détectée, actuellement non indexée" : "Introuvable (404)";
  return {
    url, verdict, coverage, indexingState: "INDEXING_ALLOWED", pageFetch: verdict === "FAIL" ? "NOT_FOUND" : "SUCCESSFUL", robots: "ALLOWED",
    googleCanonical: verdict === "PASS" ? url : null, lastCrawlAt: verdict === "NEUTRAL" ? null : new Date(Date.now() - (h % 20) * DAY).toISOString(), error: null, demo: true,
  };
}

export type InspectSummary = { checked: number; errors: number; skipped: number; demo: boolean };

/**
 * Relit chez Google l'état d'indexation des pages suivies (ou d'une seule adresse) : d'abord celles
 * jamais vérifiées, puis les plus anciennes. 20 par passage ; une page vue depuis moins de `freshMs` est sautée.
 */
export async function inspectPages(workspaceId: string, siteId: string, opts: { url?: string; freshMs?: number; max?: number } = {}): Promise<Result<InspectSummary>> {
  const conn = await db.searchConnection(workspaceId, siteId);
  if (!conn) return fail("Connectez d'abord Search Console (page Mots-clés) : c'est là que Google dit si vos pages sont indexées.");
  const site = await db.getSite(workspaceId, siteId);
  let pages: string[];
  if (opts.url) {
    const p = parseUrls(opts.url, site.url);
    if (!p.urls.length) return fail(`Cette adresse n'est pas sur ${hostOf(site.url)}.`);
    pages = p.urls.slice(0, 1);
  } else {
    const [all, seen] = await Promise.all([trackedPages(workspaceId, siteId), db.listInspections(workspaceId, siteId)]);
    const at = new Map(seen.map((x) => [x.url, new Date(x.checkedAt).getTime()]));
    const fresh = opts.freshMs ?? 3_600_000;
    pages = all.filter((u) => !at.has(u) || Date.now() - at.get(u)! > fresh).sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0));
  }
  const max = opts.max ?? INSPECT_MAX;
  const todo = pages.slice(0, max);
  const sum: InspectSummary = { checked: 0, errors: 0, skipped: pages.length - todo.length, demo: conn.demo };
  if (!todo.length) return { ok: true, value: sum };
  if (conn.demo) {
    for (const u of todo) { await db.saveInspection(workspaceId, siteId, sampleInspection(u)); sum.checked++; }
    return { ok: true, value: sum };
  }
  const g = await googleAccess(workspaceId, siteId);
  if (!g.ok) return g;
  const queue = todo.slice();
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const r = await inspectUrl(g.value.access, g.value.property, u);
      sum.checked++;
      if (!r.ok) {
        sum.errors++;
        await db.saveInspection(workspaceId, siteId, { url: u, verdict: null, coverage: null, indexingState: null, pageFetch: null, robots: null, googleCanonical: null, lastCrawlAt: null, error: r.error, demo: false });
        if (r.revoked) { queue.length = 0; return; }
        continue;
      }
      await db.saveInspection(workspaceId, siteId, { url: u, ...r.value, error: null, demo: false });
    }
  }));
  return { ok: true, value: sum };
}

// ---------------------------------------------------------------------------
// Tâche du matin
// ---------------------------------------------------------------------------

export type PositionsPass = { sites: number; measured: number; errors: number; unfinished: number; inspected: number };

/** Positions de la semaine (sites pas encore mesurés), puis indexation Google des pages vues il y a plus de 7 jours. */
export async function runPositionsDue(budgetMs = 250_000): Promise<PositionsPass> {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const out: PositionsPass = { sites: 0, measured: 0, errors: 0, unfinished: 0, inspected: 0 };
  for (const d of await db.rankDue()) {
    if (left() < 60_000) { out.unfinished++; continue; }
    const r = await runPositions(d.workspaceId, d.siteId, { budgetMs: Math.min(left() - 50_000, 120_000) }).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    out.sites++;
    if (!r.ok) { out.errors++; console.error("positions.site", d.siteId, r.error); continue; }
    out.measured += r.value.measured;
    out.errors += r.value.errors;
    if (r.value.remaining) out.unfinished++;
  }
  for (const d of await db.indexingDue()) {
    if (left() < 20_000) break;
    const r = await inspectPages(d.workspaceId, d.siteId, { freshMs: 7 * DAY }).catch(() => null);
    if (r?.ok) out.inspected += r.value.checked;
  }
  return out;
}
