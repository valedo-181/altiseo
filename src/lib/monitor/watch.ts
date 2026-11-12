/**
 * Gardien du site (lot B) : règles de décision, sans réseau (testées dans watch.test.ts).
 * Une panne n'est confirmée qu'après 2 échecs de suite (un raté isolé n'alerte personne) ; elle se
 * ferme au premier retour. Certificat SSL : alertes à 30, 7 et 1 jour(s). Domaine : à 30 et 7 jours.
 */

export type MonitorStatus = "unknown" | "up" | "down";
export type CheckResult = { ok: boolean; code: number | null; ms: number | null; error: string | null };
export type MonitorState = { status: MonitorStatus; fails: number; downSince: string | null };

export const CONFIRM_FAILS = 2;
export const SSL_THRESHOLDS = [30, 7, 1] as const;
export const DOMAIN_THRESHOLDS = [30, 7] as const;

/** Une réponse est bonne si le site répond 2xx ou 3xx (redirections suivies) en moins de 10 secondes. */
export const isUp = (code: number | null) => code != null && code >= 200 && code < 400;

export type Transition = {
  next: MonitorState;
  /** « down » : panne confirmée à l'instant ; « up » : retour après une panne confirmée. */
  event: "down" | "up" | null;
  /** Durée de la panne terminée (ms), pour l'e-mail de retour. */
  downtimeMs: number | null;
};

export function applyCheck(state: MonitorState, r: CheckResult, now: Date): Transition {
  if (r.ok) {
    if (state.status === "down") {
      const since = state.downSince ? new Date(state.downSince).getTime() : now.getTime();
      return { next: { status: "up", fails: 0, downSince: null }, event: "up", downtimeMs: Math.max(0, now.getTime() - since) };
    }
    return { next: { status: "up", fails: 0, downSince: null }, event: null, downtimeMs: null };
  }
  const fails = state.fails + 1;
  if (state.status === "down") return { next: { ...state, fails }, event: null, downtimeMs: null };
  if (fails >= CONFIRM_FAILS) {
    // La panne a commencé au premier échec : environ 5 minutes avant celui-ci.
    const start = new Date(now.getTime() - (fails - 1) * 5 * 60_000).toISOString();
    return { next: { status: "down", fails, downSince: start }, event: "down", downtimeMs: null };
  }
  return { next: { ...state, fails }, event: null, downtimeMs: null };
}

const DAY = 86_400_000;

/** Jours restants (arrondis vers le bas) avant une échéance. */
export function daysLeft(until: string, now: Date): number {
  return Math.floor((new Date(until).getTime() - now.getTime()) / DAY);
}

/**
 * Seuil à annoncer maintenant, ou null : le plus petit seuil atteint, s'il n'a pas déjà été annoncé
 * pour cette même échéance (une nouvelle date d'échéance, après renouvellement, repart à zéro).
 */
export function dueThreshold(until: string | null, thresholds: readonly number[], sent: { until?: string; threshold?: number } | undefined, now: Date): number | null {
  if (!until) return null;
  const left = daysLeft(until, now);
  const hit = [...thresholds].sort((a, b) => a - b).find((t) => left <= t);
  if (hit == null) return null;
  if (sent && sent.until === until && sent.threshold != null && sent.threshold <= hit) return null;
  return hit;
}

/** Date d'expiration dans une réponse RDAP (événement « expiration »), au format AAAA-MM-JJ. */
export function rdapExpiry(json: unknown): string | null {
  const events = (json as { events?: Array<{ eventAction?: string; eventDate?: string }> } | null)?.events;
  if (!Array.isArray(events)) return null;
  const e = events.find((x) => x?.eventAction === "expiration" && typeof x.eventDate === "string");
  const d = e ? new Date(e.eventDate!) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/** Domaine enregistré (sans sous-domaine) : « blog.exemple.ch » → « exemple.ch » ; « a.co.uk » → « a.co.uk ». */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  const second = new Set(["co", "com", "org", "net", "gov", "ac"]);
  const n = parts.length >= 3 && second.has(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-n).join(".");
}

export type Day = { day: string; checks: number; failures: number; totalMs: number };

/** Disponibilité (%) et temps de réponse moyen (ms) sur une période. */
export function uptime(days: Day[]): { pct: number | null; avgMs: number | null; checks: number } {
  const checks = days.reduce((s, d) => s + d.checks, 0);
  const fails = days.reduce((s, d) => s + d.failures, 0);
  const okChecks = checks - fails;
  const ms = days.reduce((s, d) => s + d.totalMs, 0);
  return { pct: checks ? Math.floor(((checks - fails) / checks) * 10_000) / 100 : null, avgMs: okChecks ? Math.round(ms / okChecks) : null, checks };
}

export function duration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} minute${min > 1 ? "s" : ""}`;
  const h = Math.floor(min / 60), m = min % 60;
  return `${h} heure${h > 1 ? "s" : ""}${m ? ` ${m} min` : ""}`;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
/** Adresses d'alerte : 3 au plus, séparées par des virgules ou des espaces. */
export function parseEmails(raw: string): { ok: true; value: string[] } | { ok: false; error: string } {
  const list = [...new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (list.length > 3) return { ok: false, error: "3 adresses au plus." };
  const bad = list.find((e) => !EMAIL.test(e) || e.length > 200);
  return bad ? { ok: false, error: `Cette adresse n'est pas valide : ${bad}` } : { ok: true, value: list };
}

export type Alert =
  | { kind: "down"; code: number | null; error: string | null }
  | { kind: "up"; downtimeMs: number }
  | { kind: "ssl"; days: number; until: string }
  | { kind: "domain"; days: number; until: string };

const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-CH", { dateStyle: "long", timeZone: "Europe/Zurich" }).format(new Date(iso));

/** Sujet et texte de l'e-mail d'alerte (texte simple, lisible partout). */
export function alertMessage(a: Alert, site: { name: string; url: string }, appUrl: string): { subject: string; text: string } {
  const where = `${site.name} (${site.url})`;
  const foot = `\n\nDétails : ${appUrl}/app/gardien\n— Le gardien du site Altiseo`;
  switch (a.kind) {
    case "down":
      return { subject: `Votre site ne répond plus : ${site.name}`, text: `Votre site ${where} ne répond plus depuis environ 5 minutes${a.code ? ` (erreur ${a.code})` : a.error ? ` (${a.error})` : ""}.\n\nNous le vérifions toutes les 5 minutes et vous écrirons dès qu'il répondra de nouveau. Prévenez votre hébergeur si la panne dure.${foot}` };
    case "up":
      return { subject: `Votre site répond de nouveau : ${site.name}`, text: `Bonne nouvelle : ${where} répond de nouveau. La panne a duré environ ${duration(a.downtimeMs)}.${foot}` };
    case "ssl":
      return { subject: `Certificat SSL : ${a.days <= 1 ? "expire demain" : `expire dans ${a.days} jours`} (${site.name})`, text: `Le certificat de sécurité (cadenas HTTPS) de ${where} expire le ${dateFr(a.until)}. Sans renouvellement, les visiteurs verront un avertissement « site non sécurisé » et Google le déclassera.\n\nLa plupart des hébergeurs le renouvellent tout seuls : si ce n'est pas fait dans quelques jours, contactez le vôtre.${foot}` };
    case "domain":
      return { subject: `Nom de domaine : expire dans ${a.days} jours (${site.name})`, text: `Le nom de domaine de ${where} arrive à échéance le ${dateFr(a.until)}. S'il n'est pas renouvelé, le site et les e-mails cesseront de marcher.\n\nVérifiez le renouvellement automatique chez votre registraire (Infomaniak, Hostpoint, OVH…).${foot}` };
  }
}
