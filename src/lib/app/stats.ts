import "server-only";
import { demoMode } from "@/lib/config";
import { db } from "@/lib/data/store";
import { safeFetch } from "@/lib/seo/crawl";
import type { Result } from "./service";
import { addDays, localDate } from "@/lib/domain/dates";
import { isBot, parseHit, visitorHash } from "@/lib/stats/collect";
import { change, fillDays, receiving, totals, type Period } from "@/lib/stats/summary";

/**
 * Statistiques sans cookies (lot E) : réception des pages vues (/api/collect) et chiffres de la page
 * /app/statistiques. Le secret de l'empreinte du jour : ALTISEO_STATS_SECRET, sinon celui des sessions.
 */

const secret = () => process.env.ALTISEO_STATS_SECRET?.trim() || process.env.ALTISEO_SESSION_SECRET?.trim() || "";

export async function recordHit(input: { body: string; ip: string; ua: string; country: string | null }): Promise<boolean> {
  if (isBot(input.ua)) return false;
  const hit = parseHit(input.body, input.country);
  const key = secret();
  if (!hit || !key) return false;
  const day = localDate(new Date(), "Europe/Zurich");
  return db.analyticsHit({ ...hit, visitor: visitorHash(key, day, hit.key, input.ip, input.ua) });
}

/** Tout ce que montre la page, pour une période qui finit aujourd'hui (et la même période juste avant). */
export async function statsPage(workspaceId: string, siteId: string, period: Period, now = new Date()) {
  const today = localDate(now, "Europe/Zurich");
  const from = addDays(today, -(period - 1));
  const before = addDays(from, -period);
  const [settings, days, pages, sources, devices, countries] = await Promise.all([
    db.analyticsOf(workspaceId, siteId),
    db.statsDays(workspaceId, siteId, before),
    db.statsTop(workspaceId, siteId, from, "page", 10),
    db.statsTop(workspaceId, siteId, from, "source", 8),
    db.statsTop(workspaceId, siteId, from, "device", 3),
    db.statsTop(workspaceId, siteId, from, "country", 6),
  ]);
  const series = fillDays(days.filter((d) => d.day >= from), from, today);
  const cur = totals(series);
  const prev = totals(days.filter((d) => d.day >= before && d.day < from));
  return {
    settings, series, from, today, totals: cur,
    changes: { visitors: change(cur.visitors, prev.visitors), pageviews: change(cur.pageviews, prev.pageviews) },
    pages, sources, devices, countries,
  };
}

/** Visiteurs d'un mois (rapport mensuel) : null si le site n'envoie rien. */
export async function monthVisitors(workspaceId: string, siteId: string, start: string, end: string): Promise<{ visitors: number; pageviews: number } | null> {
  const days = (await db.statsDays(workspaceId, siteId, start)).filter((d) => d.day <= end);
  if (!days.length) return null;
  const t = totals(days);
  return { visitors: t.visitors, pageviews: t.pageviews };
}

/** « Vérifier l'installation » : la page d'accueil du site contient-elle le script avec la bonne clé ? */
export async function verifyInstall(workspaceId: string, siteId: string): Promise<Result<string>> {
  const [site, a] = await Promise.all([db.getSite(workspaceId, siteId), db.analyticsOf(workspaceId, siteId)]);
  if (demoMode) return { ok: true, value: "Mode démo : installation considérée comme faite." };
  const r = await safeFetch(site.url, 10_000);
  if (r.status === 0 || !("body" in r)) return { ok: false, error: `Le site ne répond pas (${"error" in r ? r.error : "injoignable"}).` };
  if (r.status >= 400) return { ok: false, error: `Le site répond « erreur ${r.status} ».` };
  if (!r.body.includes(a.siteKey)) return { ok: false, error: "Le script n'est pas encore sur la page d'accueil. Vérifiez qu'il est collé avant </head>, puis publiez le site." };
  return { ok: true, value: receiving(a.lastHitAt) ? "Le script est en place et des visites arrivent." : "Le script est en place. Les premières visites apparaissent dès qu'une personne ouvre le site." };
}

export async function saveStatsSettings(workspaceId: string, siteId: string, enabled: boolean): Promise<Result> {
  await db.saveAnalytics(workspaceId, siteId, { enabled });
  return { ok: true, value: undefined };
}
