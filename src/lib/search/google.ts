/**
 * Google Search Console par son API officielle, en lecture seule (portée webmasters.readonly).
 * Connexion OAuth : la personne donne son accord chez Google, on garde le jeton de renouvellement
 * chiffré. Les jetons ne sortent jamais dans les messages d'erreur.
 */
import type { DayRow, QueryRow } from "./report.ts";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/webmasters/v3";
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type GoogleResult<T> = { ok: true; value: T } | { ok: false; error: string; revoked?: boolean };

const TIMEOUT_MS = 15_000;
const call = (f: Fetcher, url: string, init: RequestInit) => f(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error" });

export function consentUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: GOOGLE_SCOPE, state,
    access_type: "offline", prompt: "consent", include_granted_scopes: "false",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type Client = { clientId: string; clientSecret: string };

async function token(f: Fetcher, c: Client, body: Record<string, string>): Promise<GoogleResult<{ access: string; refresh: string | null; scope: string }>> {
  let res: Response;
  try {
    res = await call(f, TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }) });
  } catch {
    return { ok: false, error: "Google ne répond pas. Réessayez dans un instant." };
  }
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  if (!res.ok || !j.access_token) {
    if (j.error === "invalid_grant") return { ok: false, revoked: true, error: "L'accès à Google a été retiré ou a expiré. Reconnectez votre compte." };
    return { ok: false, error: "Google a refusé la connexion. Réessayez." };
  }
  return { ok: true, value: { access: j.access_token, refresh: j.refresh_token ?? null, scope: j.scope ?? "" } };
}

/** Échange le code de retour contre les jetons. Sans jeton de renouvellement ou sans la bonne portée : refus. */
export async function exchangeCode(c: Client, code: string, redirectUri: string, f: Fetcher = fetch): Promise<GoogleResult<{ access: string; refresh: string }>> {
  const r = await token(f, c, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
  if (!r.ok) return r;
  if (!r.value.scope.split(" ").includes(GOOGLE_SCOPE)) return { ok: false, error: "L'accès à Search Console n'a pas été accordé. Recommencez et cochez la case correspondante." };
  if (!r.value.refresh) return { ok: false, error: "Google n'a pas donné d'accès durable. Recommencez la connexion." };
  return { ok: true, value: { access: r.value.access, refresh: r.value.refresh } };
}

export async function refreshAccess(c: Client, refreshToken: string, f: Fetcher = fetch): Promise<GoogleResult<string>> {
  const r = await token(f, c, { grant_type: "refresh_token", refresh_token: refreshToken });
  return r.ok ? { ok: true, value: r.value.access } : r;
}

/** Retire l'accès chez Google (déconnexion). Sans importance si cela échoue : le jeton est aussi effacé chez nous. */
export async function revokeToken(refreshToken: string, f: Fetcher = fetch): Promise<void> {
  await call(f, "https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }) }).catch(() => undefined);
}

async function api<T>(f: Fetcher, access: string, path: string, body?: unknown): Promise<GoogleResult<T>> {
  let res: Response;
  try {
    res = await call(f, path.startsWith("https://") ? path : `${API}${path}`, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${access}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, error: "Google ne répond pas. Réessayez dans un instant." };
  }
  if (res.status === 401) return { ok: false, revoked: true, error: "L'accès à Google a été retiré ou a expiré. Reconnectez votre compte." };
  if (res.status === 403) return { ok: false, error: "Ce compte Google n'a plus accès à ce site dans Search Console." };
  if (res.status === 429) return { ok: false, error: "Google limite les demandes pour le moment. Réessayez dans quelques minutes." };
  if (!res.ok) return { ok: false, error: `Google a renvoyé une erreur (${res.status}).` };
  return { ok: true, value: (await res.json().catch(() => ({}))) as T };
}

export async function listProperties(access: string, f: Fetcher = fetch): Promise<GoogleResult<Array<{ siteUrl: string; permissionLevel: string }>>> {
  const r = await api<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(f, access, "/sites");
  if (!r.ok) return r;
  return { ok: true, value: (r.value.siteEntry ?? []).filter((e) => e.siteUrl).map((e) => ({ siteUrl: String(e.siteUrl), permissionLevel: String(e.permissionLevel ?? "") })) };
}

type ApiRow = { keys?: string[]; clicks?: number; impressions?: number; position?: number };
const ROW_LIMIT = 25_000;

async function analytics(f: Fetcher, access: string, property: string, from: string, to: string, dimensions: string[]): Promise<GoogleResult<ApiRow[]>> {
  const r = await api<{ rows?: ApiRow[] }>(f, access, `/sites/${encodeURIComponent(property)}/searchAnalytics/query`, { startDate: from, endDate: to, dimensions, type: "web", rowLimit: ROW_LIMIT });
  return r.ok ? { ok: true, value: r.value.rows ?? [] } : r;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Totaux par jour (exacts, recherches cachées comprises). */
export async function dailyTotals(access: string, property: string, from: string, to: string, f: Fetcher = fetch): Promise<GoogleResult<DayRow[]>> {
  const r = await analytics(f, access, property, from, to, ["date"]);
  if (!r.ok) return r;
  return { ok: true, value: r.value.filter((x) => DAY.test(x.keys?.[0] ?? "")).map((x) => ({ day: x.keys![0], clicks: num(x.clicks), impressions: num(x.impressions), position: num(x.position) })) };
}

/** Détail par jour et par recherche (Google cache les recherches trop rares). */
export async function dailyQueries(access: string, property: string, from: string, to: string, f: Fetcher = fetch): Promise<GoogleResult<QueryRow[]>> {
  const r = await analytics(f, access, property, from, to, ["date", "query"]);
  if (!r.ok) return r;
  return { ok: true, value: r.value.filter((x) => DAY.test(x.keys?.[0] ?? "") && x.keys?.[1]).map((x) => ({ day: x.keys![0], query: x.keys![1].slice(0, 200), clicks: num(x.clicks), impressions: num(x.impressions), position: num(x.position) })) };
}

// ---------------------------------------------------------------------------
// Inspection d'URL (même portée en lecture seule ; 2000 pages par jour et par propriété chez Google)
// ---------------------------------------------------------------------------

export type Inspection = {
  verdict: "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED" | null;
  coverage: string | null; indexingState: string | null; pageFetch: string | null; robots: string | null;
  googleCanonical: string | null; lastCrawlAt: string | null;
};
const VERDICTS = new Set(["PASS", "PARTIAL", "FAIL", "NEUTRAL", "VERDICT_UNSPECIFIED"]);
const cut = (v: unknown, n: number) => (typeof v === "string" && v ? v.slice(0, n) : null);

/** Lit la réponse de Google (champs inconnus ignorés, textes raccourcis). */
export function readInspection(j: unknown): Inspection {
  const r = ((j as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } })?.inspectionResult?.indexStatusResult) ?? {};
  const verdict = typeof r.verdict === "string" && VERDICTS.has(r.verdict) ? (r.verdict as Inspection["verdict"]) : null;
  const crawl = typeof r.lastCrawlTime === "string" && !Number.isNaN(new Date(r.lastCrawlTime).getTime()) ? new Date(r.lastCrawlTime).toISOString() : null;
  return {
    verdict, coverage: cut(r.coverageState, 200), indexingState: cut(r.indexingState, 60), pageFetch: cut(r.pageFetchState, 60),
    robots: cut(r.robotsTxtState, 60), googleCanonical: cut(r.googleCanonical, 2000), lastCrawlAt: crawl,
  };
}

/** État d'indexation d'une page de la propriété. */
export async function inspectUrl(access: string, property: string, url: string, f: Fetcher = fetch): Promise<GoogleResult<Inspection>> {
  const r = await api<unknown>(f, access, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: url, siteUrl: property, languageCode: "fr" });
  return r.ok ? { ok: true, value: readInspection(r.value) } : r;
}
