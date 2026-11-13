import "server-only";
import { monthVisitors } from "./stats";
import { siteOrigin } from "@/lib/config";
import { db, QuotaReached } from "@/lib/data/store";
import { localDate } from "@/lib/domain/dates";
import type { Branding, Site, Subscription } from "@/lib/domain/types";
import { ENGINE_LABEL, visibilityScore } from "@/lib/geo/analyze";
import { sendAlertEmail } from "@/lib/monitor/probe";
import { parseEmails, uptime } from "@/lib/monitor/watch";
import { summarize, type RankSummary } from "@/lib/rank/serp";
import { cleanAccent, cleanLogoUrl, compareWeeks, monthBounds, monthLabel, shiftMonth, topMovers, totalDowntimeMs, type Mover } from "@/lib/report/monthly";
import { createSiteFromUrl, type Result } from "./service";

/**
 * Offre Agence : plusieurs sites dans un espace, rapport mensuel à la marque de l'agence, lien de
 * lecture seule pour le client final et envoi du lien chaque mois (Resend, comme les alertes).
 */

const fail = (error: string): Result<never> => ({ ok: false, error });
export const isAgency = (sub: Pick<Subscription, "planCode"> | null | undefined) => sub?.planCode === "agence";

/** Nouveau site dans l'espace, dans la limite de l'offre (1, 3 ou 25). */
export async function addSite(workspaceId: string, raw: string): Promise<Result<Site>> {
  const [allowed, sites] = await Promise.all([db.sitesAllowed(workspaceId), db.listSites(workspaceId)]);
  if (sites.length >= allowed) return fail(allowed === 1 ? "Votre offre comprend 1 site. Passez à Scale (3 sites) ou Agence (25 sites) pour en ajouter." : `Votre offre comprend ${allowed} sites, tous utilisés.`);
  try {
    return await createSiteFromUrl(workspaceId, raw);
  } catch (e) {
    if (e instanceof QuotaReached) return fail(`Votre offre comprend ${allowed} sites, tous utilisés.`);
    throw e;
  }
}

export async function saveBranding(workspaceId: string, input: { agencyName: string; logoUrl: string; accent: string; contact: string }): Promise<Result> {
  const logo = cleanLogoUrl(input.logoUrl);
  if (!logo.ok) return fail(logo.error);
  if (input.accent.trim() && !cleanAccent(input.accent)) return fail("La couleur doit s'écrire comme #0F766E.");
  if (input.agencyName.trim().length > 120) return fail("Le nom de l'agence est trop long (120 caractères au plus).");
  if (input.contact.trim().length > 200) return fail("La ligne de contact est trop longue (200 caractères au plus).");
  await db.saveBranding(workspaceId, { agencyName: input.agencyName.trim(), logoUrl: logo.value, accent: cleanAccent(input.accent), contact: input.contact.trim() });
  return { ok: true, value: undefined };
}

export async function saveReportSettings(workspaceId: string, siteId: string, input: { shared: boolean; clientName: string; emails: string; monthly: boolean }): Promise<Result> {
  const emails = parseEmails(input.emails);
  if (!emails.ok) return fail(emails.error);
  if (input.monthly && !emails.value.length) return fail("Indiquez au moins une adresse pour l'envoi mensuel.");
  if (input.clientName.trim().length > 120) return fail("Le nom du client est trop long.");
  const cur = await db.reportOf(workspaceId, siteId);
  await db.saveReport(workspaceId, siteId, {
    shared: input.shared || input.monthly, clientName: input.clientName.trim(), clientEmails: emails.value, monthly: input.monthly,
    // Envoi activé en cours de mois : le premier part le 1er du mois prochain, avec le mois complet.
    ...(input.monthly && !cur.monthly ? { lastSentMonth: `${localDate(new Date(), "Europe/Zurich").slice(0, 7)}-01` } : {}),
  });
  return { ok: true, value: undefined };
}

export const reportPath = (token: string, month?: string) => `/rapport/${token}${month ? `?mois=${month}` : ""}`;

// ---------------------------------------------------------------------------
// Contenu du rapport
// ---------------------------------------------------------------------------

export type MonthlyReport = {
  month: string; label: string; from: string; to: string; partial: boolean;
  site: { name: string; url: string; host: string };
  branding: Branding;
  articles: Array<{ title: string; url: string | null; day: string }>;
  positions: { tracked: number; now: RankSummary | null; before: RankSummary | null; movers: Mover[]; best: Array<{ phrase: string; position: number }>; demo: boolean } | null;
  ai: { score: number | null; before: number | null; seen: number; total: number; engines: string[]; demo: boolean } | null;
  uptime: { pct: number | null; checks: number; incidents: number; downtimeMs: number };
  search: { clicks: number; impressions: number; prevClicks: number; prevImpressions: number; days: number; demo: boolean } | null;
  visits: { visitors: number; pageviews: number; prevVisitors: number | null; prevPageviews: number | null } | null;
};

/** Le rapport d'un mois pour un site (à lire sous runAsSystem pour le lien du client). */
export async function monthlyReport(workspaceId: string, siteId: string, month: string): Promise<MonthlyReport> {
  const { from, to } = monthBounds(month);
  const today = localDate(new Date(), "Europe/Zurich");
  const [site, branding, articles, keywords, rankWeeks, aiRuns, days, incidents, conn, search, aiPlan, maxKw] = await Promise.all([
    db.getSite(workspaceId, siteId), db.branding(workspaceId), db.listArticles(workspaceId, siteId), db.listRankKeywords(workspaceId, siteId),
    db.rankWeeks(workspaceId, siteId, 20), db.listAiRuns(workspaceId, siteId, 12), db.monitorDays(workspaceId, siteId, from),
    db.monitorIncidents(workspaceId, siteId, 50), db.searchConnection(workspaceId, siteId), db.searchReport(workspaceId, siteId),
    db.aiPlan(workspaceId), db.rankPlan(workspaceId),
  ]);
  const prevMonth = monthBounds(shiftMonth(month, -1));
  const [visitsNow, visitsBefore] = await Promise.all([monthVisitors(workspaceId, siteId, from, to), monthVisitors(workspaceId, siteId, prevMonth.from, prevMonth.to)]);
  const host = new URL(site.url).hostname.replace(/^www\./, "");

  // Articles publiés dans le mois
  const published = articles.filter((a) => a.status === "published" && a.publishedAt && a.publishedAt.slice(0, 10) >= from && a.publishedAt.slice(0, 10) <= to);
  const pubs = await Promise.all(published.map((a) => db.publicationOf(workspaceId, a.id)));
  const list = published.map((a, i) => ({ title: a.title, url: pubs[i]?.status === "ok" ? pubs[i]!.remoteUrl : null, day: a.publishedAt!.slice(0, 10) })).sort((a, b) => a.day.localeCompare(b.day));

  // Positions : dernière semaine du mois contre la dernière d'avant
  let positions: MonthlyReport["positions"] = null;
  const tracked = keywords.slice(0, maxKw);
  if (maxKw && tracked.length) {
    const w = compareWeeks(rankWeeks, month);
    const checks = await db.listRankChecks(workspaceId, siteId, [w.end, w.start].filter(Boolean) as string[]);
    const at = (week: string | null) => new Map(checks.filter((c) => c.week === week && c.status === "ok").map((c) => [c.keywordId, c.position]));
    const end = at(w.end), start = at(w.start);
    const rows = tracked.map((k) => ({ phrase: k.phrase, now: end.get(k.id) ?? null, before: w.start ? (start.has(k.id) ? start.get(k.id)! : null) : null }));
    positions = {
      tracked: tracked.length,
      now: w.end ? summarize(tracked.filter((k) => end.has(k.id)).map((k) => end.get(k.id)!)) : null,
      before: w.start ? summarize(tracked.filter((k) => start.has(k.id)).map((k) => start.get(k.id)!)) : null,
      movers: w.start ? topMovers(rows) : [],
      best: rows.filter((r): r is { phrase: string; now: number; before: number | null } => r.now != null && r.now <= 10).sort((a, b) => a.now - b.now).slice(0, 8).map((r) => ({ phrase: r.phrase, position: r.now })),
      demo: checks.some((c) => c.demo),
    };
  }

  // Visibilité IA : dernier passage du mois contre le dernier d'avant
  let ai: MonthlyReport["ai"] = null;
  if (aiPlan.maxQuestions) {
    const done = aiRuns.filter((r) => r.status !== "error");
    const endRun = done.find((r) => r.week >= from && r.week <= to) ?? null;
    const startRun = done.find((r) => r.week < from) ?? null;
    const checks = await db.listAiChecks(workspaceId, siteId, [endRun?.week, startRun?.week].filter(Boolean) as string[]);
    if (endRun) {
      const now = visibilityScore(checks.filter((c) => c.week === endRun.week));
      const before = startRun ? visibilityScore(checks.filter((c) => c.week === startRun.week)).score : null;
      ai = { score: now.score, before, seen: now.seen, total: now.total, engines: aiPlan.engines.map((e) => ENGINE_LABEL[e]), demo: endRun.demo };
    }
  }

  const inMonth = days.filter((d) => d.day <= to);
  const up = uptime(inMonth);
  const monthIncidents = incidents.filter((i) => i.startedAt.slice(0, 10) <= to && (!i.endedAt || i.endedAt.slice(0, 10) >= from));

  const searchPart = conn && search ? {
    clicks: search.current.clicks, impressions: search.current.impressions, prevClicks: search.previous.clicks, prevImpressions: search.previous.impressions,
    days: search.periodDays, demo: conn.demo,
  } : null;

  return {
    month, label: monthLabel(month), from, to, partial: today <= to,
    site: { name: site.name || host, url: site.url, host }, branding, articles: list, positions, ai,
    uptime: { pct: up.pct, checks: up.checks, incidents: monthIncidents.length, downtimeMs: totalDowntimeMs(monthIncidents, from, to) },
    search: searchPart,
    visits: visitsNow ? { ...visitsNow, prevVisitors: visitsBefore?.visitors ?? null, prevPageviews: visitsBefore?.pageviews ?? null } : null,
  };
}

// ---------------------------------------------------------------------------
// Envoi mensuel (tâche du matin)
// ---------------------------------------------------------------------------

/** Le 1er du mois (ou dès que possible ensuite) : le lien du rapport du mois passé, aux adresses du client. */
export async function sendReportsDue(): Promise<{ sent: number; failed: number }> {
  const out = { sent: 0, failed: 0 };
  const today = localDate(new Date(), "Europe/Zurich");
  const month = shiftMonth(today.slice(0, 7), -1);
  const origin = siteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  for (const r of await db.reportsDue()) {
    try {
      const sub = await db.subscription(r.workspaceId);
      if (!isAgency(sub)) continue;
      const [site, brand] = await Promise.all([db.getSite(r.workspaceId, r.siteId), db.branding(r.workspaceId)]);
      const who = brand.agencyName || "Votre agence";
      const subject = `Rapport de ${monthLabel(month)} : ${site.name || site.url}`;
      const text = [
        r.clientName ? `Bonjour ${r.clientName},` : "Bonjour,", "",
        `Le rapport de ${monthLabel(month)} pour ${site.url.replace(/^https?:\/\//, "")} est prêt : articles publiés, positions dans Google, visibilité dans les IA et disponibilité du site.`, "",
        `${origin}${reportPath(r.token, month)}`, "",
        "Vous pouvez l'enregistrer en PDF depuis la page.", "", who, brand.contact,
      ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
      if (await sendAlertEmail(r.emails, subject, text)) {
        await db.saveReport(r.workspaceId, r.siteId, { lastSentMonth: `${today.slice(0, 7)}-01` });
        out.sent++;
      } else out.failed++;
    } catch (e) {
      out.failed++;
      console.error("rapport.envoi", r.siteId, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export const nextFirst = (today: string) => `${shiftMonth(today.slice(0, 7), 1)}-01`;
