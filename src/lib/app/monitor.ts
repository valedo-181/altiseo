import "server-only";
import { siteOrigin } from "@/lib/config";
import { db } from "@/lib/data/store";
import type { MonitorDue, SiteMonitor } from "@/lib/domain/types";
import { hostOf } from "@/lib/geo/analyze";
import { certificateExpiry, checkSite, domainExpiry, sendAlertEmail } from "@/lib/monitor/probe";
import { alertMessage, applyCheck, DOMAIN_THRESHOLDS, dueThreshold, parseEmails, registrableDomain, SSL_THRESHOLDS, type Alert } from "@/lib/monitor/watch";
import type { Result } from "./service";

/**
 * Gardien du site : une vérification toutes les 5 minutes (tâche /api/cron/gardien, appelée par
 * Supabase pg_cron), certificat SSL et domaine relus une fois par jour, alertes par e-mail (Resend :
 * RESEND_API_KEY + ALERT_FROM). Sans envoi configuré, l'état reste visible dans Altiseo.
 */

const DAY = 86_400_000;
const PARALLEL = 10;
const MANUAL_COOLDOWN_MS = 60_000;
const stale = (iso: string | null, ms: number, now: Date) => !iso || now.getTime() - new Date(iso).getTime() > ms;

export const alertsConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.ALERT_FROM?.trim());

type Target = Pick<MonitorDue, "workspaceId" | "siteId" | "url" | "siteName" | "emails">;

async function notify(t: Target, a: Alert) {
  const m = alertMessage(a, { name: t.siteName, url: t.url }, siteOrigin(process.env.NEXT_PUBLIC_SITE_URL));
  const sent = await sendAlertEmail(t.emails, m.subject, m.text);
  if (!sent && alertsConfigured()) console.error("gardien.alerte", t.siteId, a.kind);
  return sent;
}

/** Une vérification complète d'un site : réponse, puis SSL et domaine s'ils datent de plus d'un jour. */
export async function checkOne(t: Target, now = new Date()): Promise<SiteMonitor> {
  const m = await db.monitorOf(t.workspaceId, t.siteId);
  const r = await checkSite(t.url);
  const at = now.toISOString();
  const tr = applyCheck({ status: m.status, fails: m.fails, downSince: m.downSince }, r, now);
  const patch: Partial<SiteMonitor> = {
    status: tr.next.status, fails: tr.next.fails, downSince: tr.next.downSince, lastCheckedAt: at,
    lastStatusCode: r.code, lastMs: r.ms, lastError: r.error?.slice(0, 300) ?? null,
  };
  await db.addMonitorDay(t.workspaceId, t.siteId, at.slice(0, 10), !r.ok, r.ok ? r.ms ?? 0 : 0);
  if (tr.event === "down") {
    await db.openIncident(t.workspaceId, t.siteId, { startedAt: tr.next.downSince ?? at, statusCode: r.code, error: r.error });
    await notify(t, { kind: "down", code: r.code, error: r.error });
  }
  if (tr.event === "up") {
    await db.closeIncident(t.workspaceId, t.siteId, at);
    await notify(t, { kind: "up", downtimeMs: tr.downtimeMs ?? 0 });
  }

  const sent = { ...m.alertsSent };
  if (r.ok && stale(m.sslCheckedAt, DAY, now)) {
    patch.sslExpiresAt = (await certificateExpiry(t.url)) ?? m.sslExpiresAt;
    patch.sslCheckedAt = at;
  }
  if (m.domainSource !== "manual" && stale(m.domainCheckedAt, DAY, now)) {
    const host = hostOf(t.url);
    const d = host ? await domainExpiry(registrableDomain(host)) : null;
    if (d) { patch.domainExpiresOn = d; patch.domainSource = "rdap"; }
    patch.domainCheckedAt = at;
  }
  const ssl = patch.sslExpiresAt ?? m.sslExpiresAt;
  const sslT = dueThreshold(ssl, SSL_THRESHOLDS, sent.ssl, now);
  if (ssl && sslT != null && await notify(t, { kind: "ssl", days: Math.max(0, Math.floor((new Date(ssl).getTime() - now.getTime()) / DAY)), until: ssl })) sent.ssl = { until: ssl, threshold: sslT };
  const dom = patch.domainExpiresOn ?? m.domainExpiresOn;
  const domIso = dom ? `${dom}T12:00:00Z` : null;
  const domT = dueThreshold(domIso, DOMAIN_THRESHOLDS, sent.domain, now);
  if (domIso && domT != null && await notify(t, { kind: "domain", days: Math.max(0, Math.floor((new Date(domIso).getTime() - now.getTime()) / DAY)), until: domIso })) sent.domain = { until: domIso, threshold: domT };
  patch.alertsSent = sent;

  await db.saveMonitor(t.workspaceId, t.siteId, patch);
  return { ...m, ...patch };
}

export type MonitorPass = { checked: number; down: number; skipped: number };

/** Tâche de fond : tous les sites à vérifier, 10 à la fois, tant qu'il reste du temps. */
export async function runMonitorsDue(budgetMs = 50_000): Promise<MonitorPass> {
  const started = Date.now();
  const queue = await db.monitorDue();
  const out: MonitorPass = { checked: 0, down: 0, skipped: 0 };
  const worker = async () => {
    for (;;) {
      if (Date.now() - started > budgetMs) return;
      const t = queue.shift();
      if (!t) return;
      try {
        const m = await checkOne(t);
        out.checked++;
        if (m.status === "down") out.down++;
      } catch (e) {
        console.error("gardien.site", t.siteId, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  out.skipped = queue.length;
  return out;
}

/** « Vérifier maintenant » : au plus une fois par minute. */
export async function checkNow(workspaceId: string, siteId: string): Promise<Result<SiteMonitor>> {
  const [site, m] = await Promise.all([db.getSite(workspaceId, siteId), db.monitorOf(workspaceId, siteId)]);
  if (m.lastCheckedAt && Date.now() - new Date(m.lastCheckedAt).getTime() < MANUAL_COOLDOWN_MS) return { ok: false, error: "Le site vient d'être vérifié. Réessayez dans une minute." };
  return { ok: true, value: await checkOne({ workspaceId, siteId, url: site.url, siteName: site.name || site.url, emails: [] }) };
}

export async function saveMonitorSettings(workspaceId: string, siteId: string, input: { enabled: boolean; emails: string; domainExpiresOn: string }): Promise<Result> {
  const emails = parseEmails(input.emails);
  if (!emails.ok) return { ok: false, error: emails.error };
  const patch: Partial<SiteMonitor> = { enabled: input.enabled, alertEmails: emails.value };
  const day = input.domainExpiresOn.trim();
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(`${day}T12:00:00Z`).getTime())) return { ok: false, error: "La date d'échéance du domaine n'est pas valide." };
    patch.domainExpiresOn = day;
    patch.domainSource = "manual";
  } else {
    const m = await db.monitorOf(workspaceId, siteId);
    if (m.domainSource === "manual") { patch.domainExpiresOn = null; patch.domainSource = null; patch.domainCheckedAt = null; }
  }
  await db.saveMonitor(workspaceId, siteId, patch);
  return { ok: true, value: undefined };
}
