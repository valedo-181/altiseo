import "server-only";
import { encryptSecret, toBytea, fromBytea, decryptSecret } from "@/lib/crypto";
import { adminClient, userClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/url";
import type { SiteAnalytics, StatsDay, StatsKind, Branding, ReportDue, SiteReport, IndexingDue, IndexNowSubmission, RankCheck, RankDue, RankKeyword, SiteIndexing, UrlInspection, MonitorDay, MonitorDue, MonitorIncident, SiteMonitor, AiCheck, AiDueSite, AiEngineName, AiPlan, AiQuestion, AiRun, Article, AuditIssue, AuditRun, CalendarItem, Competitor, Integration, Publication, SearchConnection, SearchReport, Site, Subscription, User, Workspace } from "@/lib/domain/types";
import type { DueTopic } from "@/lib/jobs/select";
import type { TopRow } from "@/lib/stats/summary";
import { AccessDenied, Conflict, QuotaReached } from "./errors";

/**
 * Couche de données sur Supabase : mêmes fonctions que demo-store.ts.
 * Lectures et écritures courantes : client de la personne connectée (la RLS filtre).
 * Écritures que la RLS réserve au serveur (articles, publications, intégrations) : client
 * service_role, toujours après avoir vérifié le site avec le client de la personne (siteOf).
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

function check<T>(r: { data: T; error: { code?: string; message: string } | null }): T {
  if (r.error) {
    if (r.error.code === "23505") throw new Conflict("Cet élément existe déjà.");
    if (r.error.code === "Q0001" || r.error.code === "Q0002") throw new QuotaReached();
    if (r.error.code === "42501") throw new AccessDenied();
    throw new Error(r.error.message);
  }
  return r.data;
}

/** Une ligne attendue (.single()) : erreur si la base n'en renvoie pas. */
function one(r: { data: Row | null; error: { code?: string; message: string } | null }): Row {
  const row = check(r);
  if (!row) throw new AccessDenied();
  return row;
}

const toSite = (r: Row): Site => ({
  id: s(r.id), workspaceId: s(r.workspace_id), url: s(r.url), name: s(r.name), theme: s(r.theme),
  language: (r.language as Site["language"]) ?? "fr", businessDescription: s(r.business_description), targetAudience: s(r.target_audience),
  tone: s(r.tone), customInstructions: s(r.custom_instructions), mentionCompetitors: Boolean(r.mention_competitors), featuredImages: r.featured_images !== false,
  publishTime: s(r.publish_time).slice(0, 5), timezone: s(r.timezone), publishDays: (r.publish_days as number[]) ?? [],
  publishMode: r.publish_mode === "publish" ? "publish" : "draft", targetWords: Number(r.target_words),
  onboardingStep: Number(r.onboarding_step), analyzedAt: (r.analyzed_at as string) ?? null, createdAt: s(r.created_at),
});

const SITE_COLS: Record<string, string> = {
  url: "url", name: "name", theme: "theme", language: "language", businessDescription: "business_description",
  targetAudience: "target_audience", tone: "tone", customInstructions: "custom_instructions", mentionCompetitors: "mention_competitors", featuredImages: "featured_images",
  publishTime: "publish_time", timezone: "timezone", publishDays: "publish_days", publishMode: "publish_mode",
  targetWords: "target_words", onboardingStep: "onboarding_step", analyzedAt: "analyzed_at",
};
function siteRow(p: Partial<Site>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) if (SITE_COLS[k] && v !== undefined) out[SITE_COLS[k]] = v;
  return out;
}

const toItem = (r: Row): CalendarItem => ({
  id: s(r.id), siteId: s(r.site_id), scheduledFor: s(r.scheduled_for), title: s(r.title), angle: s(r.angle), keyword: s(r.keyword),
  searchVolume: (r.search_volume as number) ?? null, difficulty: (r.difficulty as number) ?? null,
  status: r.status as CalendarItem["status"], regenerations: Number(r.regenerations),
});

const toArticle = (r: Row): Article => ({
  id: s(r.id), siteId: s(r.site_id), calendarItemId: (r.calendar_item_id as string) ?? null, title: s(r.title), slug: s(r.slug),
  metaTitle: s(r.meta_title), metaDescription: s(r.meta_description), bodyMd: s(r.body_md), language: (r.language as Article["language"]) ?? "fr",
  keywords: (r.keywords as string[]) ?? [], internalLinks: (r.internal_links as Article["internalLinks"]) ?? [], wordCount: Number(r.word_count),
  status: r.status as Article["status"], demo: Boolean(r.demo),
  imageUrl: (r.image_url as string) ?? null, imageAlt: s(r.image_alt), imagePrompt: (r.image_prompt as string) ?? null, imageDemo: Boolean(r.image_demo), imageGenerations: Number(r.image_generations ?? 0), publishedAt: (r.published_at as string) ?? null,
  editedAt: (r.edited_at as string) ?? null, createdAt: s(r.created_at), updatedAt: s(r.updated_at),
});
const ART_COLS: Record<string, string> = {
  title: "title", slug: "slug", metaTitle: "meta_title", metaDescription: "meta_description", bodyMd: "body_md", keywords: "keywords",
  internalLinks: "internal_links", wordCount: "word_count", status: "status", publishedAt: "published_at", editedAt: "edited_at", language: "language", demo: "demo",
};
function articleRow(p: Partial<Article>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(p)) if (ART_COLS[k] && v !== undefined) out[ART_COLS[k]] = v;
  return out;
}

const toIntegration = (r: Row): Integration => ({
  id: s(r.id), siteId: s(r.site_id), kind: r.kind as Integration["kind"], status: r.status as Integration["status"],
  config: (r.config as Integration["config"]) ?? {}, lastError: (r.last_error as string) ?? null,
  lastTestedAt: (r.last_tested_at as string) ?? null, demo: Boolean(r.demo),
});

const toPublication = (r: Row): Publication => ({
  id: s(r.id), articleId: s(r.article_id), integrationId: s(r.integration_id), remoteId: (r.remote_id as string) ?? null,
  remoteUrl: (r.remote_url as string) ?? null, remoteMediaId: (r.remote_media_id as string) ?? null, remoteMediaSrc: (r.remote_media_src as string) ?? null, status: r.status as Publication["status"], error: (r.last_error as string) ?? null,
  lastAttemptAt: s(r.last_attempt_at ?? r.updated_at),
});


const toBranding = (r: Row | null): Branding => ({ agencyName: s(r?.agency_name), logoUrl: (r?.logo_url as string) ?? null, accent: (r?.accent as string) ?? null, contact: s(r?.contact) });
const toReport = (r: Row): SiteReport => ({
  siteId: s(r.site_id), token: s(r.token), shared: Boolean(r.shared), clientName: s(r.client_name), clientEmails: (r.client_emails as string[]) ?? [],
  monthly: Boolean(r.monthly), lastSentMonth: (r.last_sent_month as string) ?? null,
});
const toRankKeyword = (r: Row): RankKeyword => ({ id: s(r.id), siteId: s(r.site_id), phrase: s(r.phrase), source: (r.source as RankKeyword["source"]) ?? "manual", createdAt: s(r.created_at) });
const toRankCheck = (r: Row): RankCheck => ({
  id: s(r.id), siteId: s(r.site_id), keywordId: s(r.keyword_id), week: s(r.week), status: r.status === "error" ? "error" : "ok",
  position: (r.position as number) ?? null, url: (r.url as string) ?? null, top: (r.top as RankCheck["top"]) ?? [],
  error: (r.error as string) ?? null, demo: Boolean(r.demo), checkedAt: s(r.checked_at),
});
const toIndexing = (r: Row): SiteIndexing => ({ siteId: s(r.site_id), indexnowKey: s(r.indexnow_key), keyVerifiedAt: (r.key_verified_at as string) ?? null, keyError: (r.key_error as string) ?? null, autoSubmit: r.auto_submit !== false });
const toSubmission = (r: Row): IndexNowSubmission => ({
  id: s(r.id), siteId: s(r.site_id), urls: (r.urls as string[]) ?? [], source: r.source === "article" ? "article" : "manual",
  statusCode: (r.status_code as number) ?? null, ok: Boolean(r.ok), error: (r.error as string) ?? null, demo: Boolean(r.demo), sentAt: s(r.sent_at),
});
const toInspection = (r: Row): UrlInspection => ({
  id: s(r.id), siteId: s(r.site_id), url: s(r.url), verdict: (r.verdict as UrlInspection["verdict"]) ?? null, coverage: (r.coverage as string) ?? null,
  indexingState: (r.indexing_state as string) ?? null, pageFetch: (r.page_fetch as string) ?? null, robots: (r.robots as string) ?? null,
  googleCanonical: (r.google_canonical as string) ?? null, lastCrawlAt: (r.last_crawl_at as string) ?? null, error: (r.error as string) ?? null,
  demo: Boolean(r.demo), checkedAt: s(r.checked_at),
});
const toAiQuestion = (r: Row): AiQuestion => ({ id: s(r.id), siteId: s(r.site_id), question: s(r.question), source: r.source === "suggested" ? "suggested" : "manual", createdAt: s(r.created_at) });
const toAiRun = (r: Row): AiRun => ({
  id: s(r.id), siteId: s(r.site_id), week: s(r.week), status: r.status as AiRun["status"], readiness: (r.readiness as AiRun["readiness"]) ?? null,
  error: (r.error as string) ?? null, demo: Boolean(r.demo), startedAt: s(r.started_at), finishedAt: (r.finished_at as string) ?? null,
});
const toAiCheck = (r: Row): AiCheck => ({
  id: s(r.id), siteId: s(r.site_id), questionId: s(r.question_id), engine: r.engine as AiEngineName, week: s(r.week), status: r.status === "error" ? "error" : "ok",
  cited: Boolean(r.cited), position: (r.position as number) ?? null, linked: Boolean(r.linked), competitors: (r.competitors as AiCheck["competitors"]) ?? [],
  sources: (r.sources as string[]) ?? [], excerpt: (r.excerpt as string) ?? null, error: (r.error as string) ?? null, demo: Boolean(r.demo), checkedAt: s(r.checked_at),
});

const MONITOR_COLS: Record<string, string> = {
  enabled: "enabled", status: "status", fails: "fails", lastCheckedAt: "last_checked_at", lastStatusCode: "last_status_code", lastMs: "last_ms",
  lastError: "last_error", downSince: "down_since", sslExpiresAt: "ssl_expires_at", sslCheckedAt: "ssl_checked_at", domainExpiresOn: "domain_expires_on",
  domainSource: "domain_source", domainCheckedAt: "domain_checked_at", alertEmails: "alert_emails", alertsSent: "alerts_sent",
};
const toMonitor = (r: Row): SiteMonitor => ({
  siteId: s(r.site_id), enabled: r.enabled !== false, status: (r.status as SiteMonitor["status"]) ?? "unknown", fails: Number(r.fails ?? 0),
  lastCheckedAt: (r.last_checked_at as string) ?? null, lastStatusCode: (r.last_status_code as number) ?? null, lastMs: (r.last_ms as number) ?? null,
  lastError: (r.last_error as string) ?? null, downSince: (r.down_since as string) ?? null, sslExpiresAt: (r.ssl_expires_at as string) ?? null,
  sslCheckedAt: (r.ssl_checked_at as string) ?? null, domainExpiresOn: (r.domain_expires_on as string) ?? null,
  domainSource: (r.domain_source as SiteMonitor["domainSource"]) ?? null, domainCheckedAt: (r.domain_checked_at as string) ?? null,
  alertEmails: (r.alert_emails as string[]) ?? [], alertsSent: (r.alerts_sent as SiteMonitor["alertsSent"]) ?? {},
});

/** Le site existe, appartient à l'espace, et la personne connectée y a accès (RLS). */
async function siteOf(workspaceId: string, siteId: string): Promise<Site> {
  const sb = await userClient();
  const r = await sb.from("sites").select("*").eq("id", siteId).eq("workspace_id", workspaceId).maybeSingle();
  const row = check(r);
  if (!row) throw new AccessDenied();
  return toSite(row);
}

export const supabaseDb = {
  async findUserByEmail(): Promise<User | null> {
    throw new Error("Non utilisé avec Supabase : la connexion passe par un lien envoyé par e-mail.");
  },
  /** Seulement la personne connectée (Supabase Auth). */
  async getUser(id: string): Promise<User | null> {
    const sb = await userClient();
    const { data } = await sb.auth.getUser();
    const u = data.user;
    if (!u || u.id !== id) return null;
    return { id: u.id, email: u.email ?? "", name: (u.user_metadata?.name as string) || null, createdAt: u.created_at };
  },
  async createAccount(): Promise<{ user: User; workspace: Workspace }> {
    throw new Error("Non utilisé avec Supabase : le compte est créé par Supabase Auth, l'espace par ensure_workspace.");
  },
  async workspaceOf(userId: string): Promise<Workspace | null> {
    const sb = await userClient();
    const m = check(await sb.from("memberships").select("workspace_id, workspaces(id, name, created_at)").eq("user_id", userId).order("created_at").limit(1).maybeSingle());
    const w = m?.workspaces as unknown as Row | null;
    return w ? { id: s(w.id), name: s(w.name), createdAt: s(w.created_at) } : null;
  },
  async subscription(workspaceId: string): Promise<(Subscription & { used: number }) | null> {
    const sb = await userClient();
    const r = check(await sb.from("subscriptions").select("*, plans(articles_per_month)").eq("workspace_id", workspaceId).maybeSingle());
    if (!r) return null;
    const perMonth = Number((r.plans as Row | null)?.articles_per_month ?? 0);
    const left = check(await sb.rpc("articles_left", { wid: workspaceId })) as number | null;
    return {
      workspaceId, planCode: r.plan_code, status: r.status, trialEndsAt: r.trial_ends_at, currentPeriodStart: r.current_period_start,
      articlesPerMonth: perMonth, used: left == null ? 0 : Math.max(0, perMonth - left),
    };
  },

  // Sites -------------------------------------------------------------------
  async listSites(workspaceId: string) {
    const sb = await userClient();
    return (check(await sb.from("sites").select("*").eq("workspace_id", workspaceId).order("created_at")) ?? []).map(toSite);
  },
  getSite: siteOf,
  async createSite(workspaceId: string, data: Omit<Site, "id" | "workspaceId" | "createdAt">) {
    const sb = await userClient();
    try {
      return toSite(one(await sb.from("sites").insert({ workspace_id: workspaceId, ...siteRow(data) }).select("*").single()));
    } catch (e) {
      if (e instanceof Conflict) throw new Conflict("Ce site est déjà dans votre espace.");
      throw e;
    }
  },
  async updateSite(workspaceId: string, siteId: string, patch: Partial<Omit<Site, "id" | "workspaceId" | "createdAt">>) {
    const sb = await userClient();
    const row = check(await sb.from("sites").update(siteRow(patch)).eq("id", siteId).eq("workspace_id", workspaceId).select("*").maybeSingle());
    if (!row) throw new AccessDenied();
    return toSite(row);
  },
  async listCompetitors(workspaceId: string, siteId: string): Promise<Competitor[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("competitors").select("*").eq("site_id", siteId).order("created_at")) ?? []).map((r: Row) => ({
      id: s(r.id), siteId, url: s(r.url), name: s(r.name), source: r.source as Competitor["source"],
    }));
  },
  async setCompetitors(workspaceId: string, siteId: string, list: Array<{ url: string; name: string }>) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    check(await sb.from("competitors").delete().eq("site_id", siteId));
    const uniq = [...new Map(list.map((c) => [c.url, c])).values()];
    if (uniq.length) check(await sb.from("competitors").insert(uniq.map((c) => ({ workspace_id: workspaceId, site_id: siteId, url: c.url, name: c.name, source: "manual" }))));
    return this.listCompetitors(workspaceId, siteId);
  },

  // Calendrier --------------------------------------------------------------
  async listCalendar(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("calendar_items").select("*").eq("site_id", siteId).order("scheduled_for")) ?? []).map(toItem);
  },
  async replaceProposed(workspaceId: string, siteId: string, drafts: Array<Pick<CalendarItem, "scheduledFor" | "title" | "angle" | "keyword"> & Partial<Pick<CalendarItem, "searchVolume" | "difficulty">>>) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    check(await sb.from("calendar_items").delete().eq("site_id", siteId).eq("status", "proposed"));
    const busy = new Set((check(await sb.from("calendar_items").select("scheduled_for").eq("site_id", siteId)) ?? []).map((r: Row) => s(r.scheduled_for)));
    const rows = drafts.filter((d) => !busy.has(d.scheduledFor)).map((d) => ({
      workspace_id: workspaceId, site_id: siteId, scheduled_for: d.scheduledFor, title: d.title.slice(0, 200), angle: d.angle.slice(0, 1000),
      keyword: d.keyword, search_volume: d.searchVolume ?? null, difficulty: d.difficulty ?? null, status: "proposed",
    }));
    if (rows.length) check(await sb.from("calendar_items").insert(rows));
    return busy.size + rows.length;
  },
  async updateCalendarItem(workspaceId: string, itemId: string, fn: (item: CalendarItem) => void) {
    const sb = await userClient();
    const row = check(await sb.from("calendar_items").select("*").eq("id", itemId).eq("workspace_id", workspaceId).maybeSingle());
    if (!row) throw new AccessDenied();
    const item = toItem(row);
    fn(item);
    const upd = one(await sb.from("calendar_items").update({
      title: item.title, angle: item.angle, keyword: item.keyword, status: item.status, regenerations: item.regenerations,
      search_volume: item.searchVolume, difficulty: item.difficulty,
    }).eq("id", itemId).select("*").single());
    return toItem(upd);
  },
  async approveAll(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("calendar_items").update({ status: "approved" }).eq("site_id", siteId).eq("status", "proposed").select("id")) ?? []).length;
  },

  // Articles ----------------------------------------------------------------
  async listArticles(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("articles").select("*").eq("site_id", siteId).neq("status", "archived").order("created_at", { ascending: false })) ?? []).map(toArticle);
  },
  async getArticle(workspaceId: string, articleId: string) {
    const sb = await userClient();
    const r = check(await sb.from("articles").select("*").eq("id", articleId).eq("workspace_id", workspaceId).maybeSingle());
    return r ? toArticle(r) : null;
  },
  /** Création réservée au serveur (quota et coût IA justes) : vérifie le site puis écrit en service_role. */
  async createArticle(workspaceId: string, data: Omit<Article, "id" | "createdAt" | "updatedAt">, cost?: { inputTokens: number; outputTokens: number; microUsd: number }) {
    await siteOf(workspaceId, data.siteId);
    const ad = adminClient();
    const row = one(await ad.from("articles").insert({
      workspace_id: workspaceId, site_id: data.siteId, calendar_item_id: data.calendarItemId, ...articleRow(data),
      counted_in_period: new Date().toISOString().slice(0, 10), // le déclencheur le remplace par la période en cours et vérifie le quota
      ai_input_tokens: cost?.inputTokens ?? 0, ai_output_tokens: cost?.outputTokens ?? 0, ai_cost_micro_usd: cost?.microUsd ?? 0,
    }).select("*").single());
    if (data.calendarItemId) check(await ad.from("calendar_items").update({ status: "done" }).eq("id", data.calendarItemId).eq("workspace_id", workspaceId));
    return toArticle(row);
  },
  async updateArticle(workspaceId: string, articleId: string, patch: Partial<Omit<Article, "id" | "siteId" | "createdAt">>) {
    const sb = await userClient();
    try {
      const row = check(await sb.from("articles").update(articleRow(patch)).eq("id", articleId).eq("workspace_id", workspaceId).select("*").maybeSingle());
      if (!row) throw new AccessDenied();
      return toArticle(row);
    } catch (e) {
      if (e instanceof Conflict) throw new Conflict("Ce slug existe déjà sur le site.");
      throw e;
    }
  },
  async slugsOf(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("articles").select("slug").eq("site_id", siteId)) ?? []).map((r: Row) => s(r.slug));
  },

  // Intégrations et publications -------------------------------------------
  async listIntegrations(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return (check(await sb.from("integrations_public").select("*").eq("site_id", siteId).neq("status", "disabled")) ?? []).map(toIntegration);
  },
  /** Une seule intégration active par site. Le secret (mot de passe d'application) est chiffré. */
  async saveIntegration(workspaceId: string, siteId: string, data: Omit<Integration, "id" | "siteId">, secret?: string) {
    await siteOf(workspaceId, siteId);
    const ad = adminClient();
    check(await ad.from("integrations").update({ status: "disabled", credentials_enc: null }).eq("site_id", siteId).neq("status", "disabled"));
    const row = one(await ad.from("integrations").insert({
      workspace_id: workspaceId, site_id: siteId, kind: data.kind, status: data.status, config: data.config, last_error: data.lastError,
      last_tested_at: data.lastTestedAt, demo: data.demo, credentials_enc: secret ? toBytea(encryptSecret(secret)) : null,
    }).select("id, workspace_id, site_id, kind, config, status, last_error, last_tested_at, demo").single());
    return toIntegration(row);
  },
  /** Secret déchiffré, pour l'envoi au CMS côté serveur. Jamais renvoyé au navigateur. */
  async integrationSecret(workspaceId: string, integrationId: string): Promise<string | null> {
    const sb = await userClient();
    const visible = check(await sb.from("integrations_public").select("id").eq("id", integrationId).eq("workspace_id", workspaceId).maybeSingle());
    if (!visible) throw new AccessDenied();
    const r = one(await adminClient().from("integrations").select("credentials_enc").eq("id", integrationId).single());
    return r.credentials_enc ? decryptSecret(fromBytea(String(r.credentials_enc))) : null;
  },
  async disableIntegration(workspaceId: string, integrationId: string) {
    const sb = await userClient();
    const visible = check(await sb.from("integrations_public").select("id").eq("id", integrationId).eq("workspace_id", workspaceId).maybeSingle());
    if (!visible) throw new AccessDenied();
    check(await adminClient().from("integrations").update({ status: "disabled", credentials_enc: null, config: {} }).eq("id", integrationId));
  },
  async publicationOf(workspaceId: string, articleId: string) {
    const sb = await userClient();
    const r = check(await sb.from("publications").select("*").eq("article_id", articleId).eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(1).maybeSingle());
    return r ? toPublication(r) : null;
  },
  async recordPublication(workspaceId: string, p: Omit<Publication, "id">) {
    const a = await this.getArticle(workspaceId, p.articleId);
    if (!a) throw new AccessDenied();
    const row = one(await adminClient().from("publications").upsert({
      workspace_id: workspaceId, article_id: p.articleId, integration_id: p.integrationId, remote_id: p.remoteId, remote_url: p.remoteUrl, remote_media_id: p.remoteMediaId ?? null, remote_media_src: p.remoteMediaSrc ?? null,
      status: p.status, last_error: p.error, last_attempt_at: p.lastAttemptAt,
    }, { onConflict: "article_id,integration_id" }).select("*").single());
    return toPublication(row);
  },

  // Audit ---------------------------------------------------------------------
  /** Écrit par le serveur (service_role) après vérification du site ; les membres lisent seulement. */
  async saveAudit(workspaceId: string, siteId: string, run: Omit<AuditRun, "id" | "siteId" | "createdAt">) {
    await siteOf(workspaceId, siteId);
    const ad = adminClient();
    const at = new Date().toISOString();
    const row = one(await ad.from("audit_runs").insert({
      workspace_id: workspaceId, site_id: siteId, status: run.status, pages_crawled: run.pagesCrawled, score: run.score,
      speed: run.speed, error: run.error, started_at: at, finished_at: at,
    }).select("*").single());
    if (run.issues.length) {
      check(await ad.from("audit_issues").insert(run.issues.map((i) => ({
        workspace_id: workspaceId, audit_run_id: row.id, code: i.code, level: i.level, affected: i.affected, total: i.total, pages: i.pages, detail: i.detail,
      }))));
    }
    return { ...run, id: s(row.id), siteId, createdAt: s(row.created_at) } as AuditRun;
  },
  async latestAudit(workspaceId: string, siteId: string): Promise<AuditRun | null> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("audit_runs").select("*, audit_issues(*)").eq("site_id", siteId).in("status", ["done", "failed"]).order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (!r) return null;
    const issues: AuditIssue[] = ((r.audit_issues as Row[]) ?? []).map((i) => ({
      code: s(i.code), level: i.level as AuditIssue["level"], affected: Number(i.affected), total: Number(i.total), pages: (i.pages as string[]) ?? [], detail: (i.detail as string) ?? null,
    }));
    return { id: s(r.id), siteId, status: r.status, pagesCrawled: Number(r.pages_crawled), score: r.score, speed: r.speed, error: r.error, createdAt: s(r.created_at), issues };
  },

  // Mots-clés (Google Search Console) ---------------------------------------
  // Lecture : client de la personne (la RLS filtre, le jeton n'est pas lisible). Écriture : serveur.
  async searchConnection(workspaceId: string, siteId: string): Promise<SearchConnection | null> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("search_connections").select("site_id, property, status, last_error, last_synced_at, demo").eq("site_id", siteId).maybeSingle()) as Row | null;
    if (!r) return null;
    return { siteId: s(r.site_id), property: s(r.property), status: r.status === "error" ? "error" : "ok", lastError: (r.last_error as string) ?? null, lastSyncedAt: (r.last_synced_at as string) ?? null, demo: Boolean(r.demo) };
  },
  async searchReport(workspaceId: string, siteId: string): Promise<SearchReport | null> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("search_connections").select("report").eq("site_id", siteId).maybeSingle()) as Row | null;
    return (r?.report as SearchReport | null) ?? null;
  },
  async saveSearchConnection(workspaceId: string, siteId: string, data: { property: string; demo: boolean }, secret?: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("search_connections").upsert({
      site_id: siteId, workspace_id: workspaceId, property: data.property, demo: data.demo, status: "ok", last_error: null, last_synced_at: null,
      report: null, credentials_enc: secret ? toBytea(encryptSecret(secret)) : null,
    }, { onConflict: "site_id" }));
  },
  /** Jeton Google déchiffré, pour les appels côté serveur. Jamais renvoyé au navigateur. */
  async searchSecret(workspaceId: string, siteId: string): Promise<string | null> {
    await siteOf(workspaceId, siteId);
    const r = check(await adminClient().from("search_connections").select("credentials_enc").eq("site_id", siteId).maybeSingle()) as Row | null;
    return r?.credentials_enc ? decryptSecret(fromBytea(String(r.credentials_enc))) : null;
  },
  async saveSearchReport(workspaceId: string, siteId: string, report: SearchReport) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("search_connections").update({ report, status: "ok", last_error: null, last_synced_at: new Date().toISOString() }).eq("site_id", siteId));
  },
  async markSearchError(workspaceId: string, siteId: string, error: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("search_connections").update({ status: "error", last_error: error }).eq("site_id", siteId));
  },
  async removeSearchConnection(workspaceId: string, siteId: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("search_connections").delete().eq("site_id", siteId));
  },

  // Visibilité IA -------------------------------------------------------------
  // Lecture : client de la personne (la RLS filtre). Écriture : serveur, après siteOf.
  async aiPlan(workspaceId: string): Promise<AiPlan> {
    const sb = await userClient();
    const r = check(await sb.from("subscriptions").select("plans(ai_questions, ai_engines)").eq("workspace_id", workspaceId).maybeSingle()) as Row | null;
    const p = (r?.plans as Row | null) ?? null;
    return { maxQuestions: Number(p?.ai_questions ?? 0), engines: ((p?.ai_engines as AiEngineName[]) ?? []) };
  },
  async listAiQuestions(workspaceId: string, siteId: string): Promise<AiQuestion[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("ai_questions").select("*").eq("site_id", siteId).order("created_at").order("question")) as Row[] | null) ?? []).map(toAiQuestion);
  },
  /** Ajoute les questions dans l'ordre ; s'arrête au quota de l'offre, ignore les doublons. Rend le nombre ajouté. */
  async addAiQuestions(workspaceId: string, siteId: string, items: Array<{ question: string; source: AiQuestion["source"] }>): Promise<number> {
    await siteOf(workspaceId, siteId);
    let n = 0;
    for (const it of items) {
      const r = await adminClient().from("ai_questions").insert({ workspace_id: workspaceId, site_id: siteId, question: it.question, source: it.source });
      if (r.error?.code === "23505") continue;
      if (r.error?.code === "Q0001") break;
      check(r);
      n++;
    }
    return n;
  },
  async removeAiQuestion(workspaceId: string, siteId: string, questionId: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("ai_questions").delete().eq("id", questionId).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  async listAiRuns(workspaceId: string, siteId: string, limit = 8): Promise<AiRun[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("ai_runs").select("*").eq("site_id", siteId).order("week", { ascending: false }).limit(limit)) as Row[] | null) ?? []).map(toAiRun);
  },
  /** Passage de la semaine : créé, ou repris s'il est resté en cours ; null s'il est déjà terminé. */
  async claimAiRun(workspaceId: string, siteId: string, week: string, demo: boolean): Promise<AiRun | null> {
    await siteOf(workspaceId, siteId);
    const ad = adminClient();
    for (let attempt = 0; attempt < 2; attempt++) {
      const cur = check(await ad.from("ai_runs").select("*").eq("site_id", siteId).eq("week", week).maybeSingle()) as Row | null;
      if (cur) return cur.status === "running" ? toAiRun(cur) : null;
      const ins = await ad.from("ai_runs").insert({ workspace_id: workspaceId, site_id: siteId, week, demo }).select("*").single();
      if (ins.error?.code === "23505") continue; // créé au même moment par un autre passage
      return toAiRun(one(ins));
    }
    return null;
  },
  async updateAiRun(workspaceId: string, siteId: string, runId: string, patch: Partial<Pick<AiRun, "status" | "readiness" | "error">> & { finished?: boolean }) {
    await siteOf(workspaceId, siteId);
    const row: Row = {};
    if (patch.status) row.status = patch.status;
    if (patch.readiness !== undefined) row.readiness = patch.readiness;
    if (patch.error !== undefined) row.error = patch.error?.slice(0, 500) ?? null;
    if (patch.finished) row.finished_at = new Date().toISOString();
    check(await adminClient().from("ai_runs").update(row).eq("id", runId).eq("site_id", siteId));
  },
  async listAiChecks(workspaceId: string, siteId: string, weeks: string[]): Promise<AiCheck[]> {
    await siteOf(workspaceId, siteId);
    if (!weeks.length) return [];
    const sb = await userClient();
    return ((check(await sb.from("ai_checks").select("*").eq("site_id", siteId).in("week", weeks)) as Row[] | null) ?? []).map(toAiCheck);
  },
  async saveAiCheck(workspaceId: string, siteId: string, c: Omit<AiCheck, "id" | "siteId" | "checkedAt">) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("ai_checks").upsert({
      workspace_id: workspaceId, site_id: siteId, question_id: c.questionId, engine: c.engine, week: c.week, status: c.status,
      cited: c.cited, position: c.position, linked: c.linked, competitors: c.competitors, sources: c.sources.slice(0, 20),
      excerpt: c.excerpt?.slice(0, 1500) ?? null, error: c.error?.slice(0, 500) ?? null, demo: c.demo, checked_at: new Date().toISOString(),
    }, { onConflict: "question_id,engine,week" }));
  },
  async aiVisibilityDue(): Promise<AiDueSite[]> {
    return ((check(await adminClient().rpc("ai_visibility_due")) as Row[] | null) ?? []).map((r) => ({
      workspaceId: s(r.workspace_id), siteId: s(r.site_id), maxQuestions: Number(r.max_questions), engines: (r.engines as AiEngineName[]) ?? [],
    }));
  },

  // Offre Agence ----------------------------------------------------------------
  async sitesAllowed(workspaceId: string): Promise<number> {
    const sb = await userClient();
    const r = check(await sb.from("subscriptions").select("plans(sites)").eq("workspace_id", workspaceId).maybeSingle()) as Row | null;
    return Number((r?.plans as Row | null)?.sites ?? 1);
  },
  async branding(workspaceId: string): Promise<Branding> {
    const sb = await userClient();
    return toBranding(check(await sb.from("workspace_branding").select("*").eq("workspace_id", workspaceId).maybeSingle()) as Row | null);
  },
  /** Réservé aux propriétaires et administrateurs de l'espace (vérifié ici, l'écriture passe par le serveur). */
  async saveBranding(workspaceId: string, b: Branding) {
    const sb = await userClient();
    const ok = check(await sb.rpc("is_admin", { wid: workspaceId }));
    if (!ok) throw new AccessDenied();
    check(await adminClient().from("workspace_branding").upsert({ workspace_id: workspaceId, agency_name: b.agencyName || null, logo_url: b.logoUrl, accent: b.accent, contact: b.contact || null }, { onConflict: "workspace_id" }));
  },
  async reportOf(workspaceId: string, siteId: string): Promise<SiteReport> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("site_reports").select("*").eq("site_id", siteId).maybeSingle()) as Row | null;
    if (r) return toReport(r);
    return toReport(one(await adminClient().from("site_reports").upsert({ site_id: siteId, workspace_id: workspaceId }, { onConflict: "site_id" }).select("*").single()));
  },
  async saveReport(workspaceId: string, siteId: string, patch: Partial<Pick<SiteReport, "shared" | "clientName" | "clientEmails" | "monthly" | "lastSentMonth">> & { newToken?: boolean }) {
    await siteOf(workspaceId, siteId);
    const row: Row = {};
    if (patch.shared !== undefined) row.shared = patch.shared;
    if (patch.clientName !== undefined) row.client_name = patch.clientName || null;
    if (patch.clientEmails !== undefined) row.client_emails = patch.clientEmails.slice(0, 3);
    if (patch.monthly !== undefined) row.monthly = patch.monthly;
    if (patch.lastSentMonth !== undefined) row.last_sent_month = patch.lastSentMonth;
    if (patch.newToken) row.token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    if (Object.keys(row).length) check(await adminClient().from("site_reports").update(row).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  /** Lien du client (sans compte) : le site du jeton, seulement si l'agence a activé le partage. */
  async reportByToken(token: string): Promise<{ workspaceId: string; siteId: string } | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const r = check(await adminClient().from("site_reports").select("site_id, workspace_id, shared").eq("token", token).maybeSingle()) as Row | null;
    return r && r.shared ? { workspaceId: s(r.workspace_id), siteId: s(r.site_id) } : null;
  },
  async reportsDue(): Promise<ReportDue[]> {
    return ((check(await adminClient().rpc("reports_due")) as Row[] | null) ?? []).map((r) => ({
      workspaceId: s(r.workspace_id), siteId: s(r.site_id), token: s(r.token), clientName: s(r.client_name), emails: (r.emails as string[]) ?? [],
    }));
  },

  // Positions Google ------------------------------------------------------------
  async rankPlan(workspaceId: string): Promise<number> {
    const sb = await userClient();
    const r = check(await sb.from("subscriptions").select("plans(rank_keywords)").eq("workspace_id", workspaceId).maybeSingle()) as Row | null;
    return Number((r?.plans as Row | null)?.rank_keywords ?? 0);
  },
  async listRankKeywords(workspaceId: string, siteId: string): Promise<RankKeyword[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("rank_keywords").select("*").eq("site_id", siteId).order("created_at").order("phrase")) as Row[] | null) ?? []).map(toRankKeyword);
  },
  /** Ajoute dans l'ordre ; s'arrête au quota de l'offre, ignore les doublons. Rend le nombre ajouté. */
  async addRankKeywords(workspaceId: string, siteId: string, items: Array<{ phrase: string; source: RankKeyword["source"] }>): Promise<number> {
    await siteOf(workspaceId, siteId);
    let n = 0;
    for (const it of items) {
      const r = await adminClient().from("rank_keywords").insert({ workspace_id: workspaceId, site_id: siteId, phrase: it.phrase, source: it.source });
      if (r.error?.code === "23505") continue;
      if (r.error?.code === "Q0001") break;
      check(r);
      n++;
    }
    return n;
  },
  async removeRankKeyword(workspaceId: string, siteId: string, keywordId: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("rank_keywords").delete().eq("id", keywordId).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  async listRankChecks(workspaceId: string, siteId: string, weeks: string[]): Promise<RankCheck[]> {
    await siteOf(workspaceId, siteId);
    if (!weeks.length) return [];
    const sb = await userClient();
    return ((check(await sb.from("rank_checks").select("*").eq("site_id", siteId).in("week", weeks)) as Row[] | null) ?? []).map(toRankCheck);
  },
  /** Semaines mesurées, de la plus récente à la plus ancienne. */
  async rankWeeks(workspaceId: string, siteId: string, limit = 12): Promise<string[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const rows = (check(await sb.from("rank_checks").select("week").eq("site_id", siteId).order("week", { ascending: false }).limit(5000)) as Row[] | null) ?? [];
    return [...new Set(rows.map((r) => s(r.week)))].slice(0, limit);
  },
  async saveRankCheck(workspaceId: string, siteId: string, c: Omit<RankCheck, "id" | "siteId" | "checkedAt">) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("rank_checks").upsert({
      workspace_id: workspaceId, site_id: siteId, keyword_id: c.keywordId, week: c.week, status: c.status, position: c.position,
      url: c.url?.slice(0, 2000) ?? null, top: c.top.slice(0, 3), error: c.error?.slice(0, 500) ?? null, demo: c.demo, checked_at: new Date().toISOString(),
    }, { onConflict: "keyword_id,week" }));
  },
  async rankDue(): Promise<RankDue[]> {
    return ((check(await adminClient().rpc("rank_due")) as Row[] | null) ?? []).map((r) => ({ workspaceId: s(r.workspace_id), siteId: s(r.site_id), maxKeywords: Number(r.max_keywords) }));
  },

  // Indexation (IndexNow + inspection d'URL) ----------------------------------------
  async indexingOf(workspaceId: string, siteId: string): Promise<SiteIndexing> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("site_indexing").select("*").eq("site_id", siteId).maybeSingle()) as Row | null;
    if (r) return toIndexing(r);
    // Créée à la première visite : la clé est tirée au hasard par la base.
    return toIndexing(one(await adminClient().from("site_indexing").upsert({ site_id: siteId, workspace_id: workspaceId }, { onConflict: "site_id", ignoreDuplicates: false }).select("*").single()));
  },
  async saveIndexing(workspaceId: string, siteId: string, patch: Partial<Pick<SiteIndexing, "keyVerifiedAt" | "keyError" | "autoSubmit">>) {
    await siteOf(workspaceId, siteId);
    const row: Row = {};
    if (patch.keyVerifiedAt !== undefined) row.key_verified_at = patch.keyVerifiedAt;
    if (patch.keyError !== undefined) row.key_error = patch.keyError?.slice(0, 300) ?? null;
    if (patch.autoSubmit !== undefined) row.auto_submit = patch.autoSubmit;
    if (Object.keys(row).length) check(await adminClient().from("site_indexing").update(row).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  async addSubmission(workspaceId: string, siteId: string, x: Omit<IndexNowSubmission, "id" | "siteId" | "sentAt">) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("indexnow_submissions").insert({
      workspace_id: workspaceId, site_id: siteId, urls: x.urls.slice(0, 100), source: x.source, status_code: x.statusCode, ok: x.ok, error: x.error?.slice(0, 300) ?? null, demo: x.demo,
    }));
  },
  async listSubmissions(workspaceId: string, siteId: string, limit = 10): Promise<IndexNowSubmission[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("indexnow_submissions").select("*").eq("site_id", siteId).order("sent_at", { ascending: false }).limit(limit)) as Row[] | null) ?? []).map(toSubmission);
  },
  async listInspections(workspaceId: string, siteId: string): Promise<UrlInspection[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("url_inspections").select("*").eq("site_id", siteId).order("url").limit(500)) as Row[] | null) ?? []).map(toInspection);
  },
  async saveInspection(workspaceId: string, siteId: string, x: Omit<UrlInspection, "id" | "siteId" | "checkedAt">) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("url_inspections").upsert({
      workspace_id: workspaceId, site_id: siteId, url: x.url.slice(0, 2000), verdict: x.verdict, coverage: x.coverage, indexing_state: x.indexingState,
      page_fetch: x.pageFetch, robots: x.robots, google_canonical: x.googleCanonical, last_crawl_at: x.lastCrawlAt, error: x.error?.slice(0, 300) ?? null,
      demo: x.demo, checked_at: new Date().toISOString(),
    }, { onConflict: "site_id,url" }));
  },
  async indexingDue(): Promise<IndexingDue[]> {
    return ((check(await adminClient().rpc("indexing_due")) as Row[] | null) ?? []).map((r) => ({ workspaceId: s(r.workspace_id), siteId: s(r.site_id) }));
  },

  // Gardien du site -------------------------------------------------------------
  async monitorOf(workspaceId: string, siteId: string): Promise<SiteMonitor> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = check(await sb.from("site_monitors").select("*").eq("site_id", siteId).maybeSingle()) as Row | null;
    if (r) return toMonitor(r);
    // Site créé avant le gardien et oublié par la migration : on le crée maintenant.
    return toMonitor(one(await adminClient().from("site_monitors").upsert({ site_id: siteId, workspace_id: workspaceId }, { onConflict: "site_id" }).select("*").single()));
  },
  async saveMonitor(workspaceId: string, siteId: string, patch: Partial<Omit<SiteMonitor, "siteId">>) {
    await siteOf(workspaceId, siteId);
    const row: Row = {};
    for (const [k, v] of Object.entries(patch)) if (MONITOR_COLS[k] && v !== undefined) row[MONITOR_COLS[k]] = v;
    if (Object.keys(row).length) check(await adminClient().from("site_monitors").update(row).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  async addMonitorDay(workspaceId: string, siteId: string, day: string, failed: boolean, ms: number) {
    check(await adminClient().rpc("monitor_add_day", { p_site: siteId, p_workspace: workspaceId, p_day: day, p_failed: failed, p_ms: Math.round(ms) }));
  },
  async monitorDays(workspaceId: string, siteId: string, since: string): Promise<MonitorDay[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("monitor_days").select("*").eq("site_id", siteId).gte("day", since).order("day")) as Row[] | null) ?? [])
      .map((r) => ({ day: s(r.day), checks: Number(r.checks), failures: Number(r.failures), totalMs: Number(r.total_ms) }));
  },
  async monitorIncidents(workspaceId: string, siteId: string, limit = 10): Promise<MonitorIncident[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("monitor_incidents").select("*").eq("site_id", siteId).order("started_at", { ascending: false }).limit(limit)) as Row[] | null) ?? [])
      .map((r) => ({ id: s(r.id), siteId: s(r.site_id), startedAt: s(r.started_at), endedAt: (r.ended_at as string) ?? null, statusCode: (r.status_code as number) ?? null, error: (r.error as string) ?? null }));
  },
  async openIncident(workspaceId: string, siteId: string, i: { startedAt: string; statusCode: number | null; error: string | null }) {
    await siteOf(workspaceId, siteId);
    const r = await adminClient().from("monitor_incidents").insert({ site_id: siteId, workspace_id: workspaceId, started_at: i.startedAt, status_code: i.statusCode, error: i.error?.slice(0, 300) ?? null });
    if (r.error?.code !== "23505") check(r); // déjà ouverte : rien à faire
  },
  async closeIncident(workspaceId: string, siteId: string, endedAt: string) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("monitor_incidents").update({ ended_at: endedAt }).eq("site_id", siteId).eq("workspace_id", workspaceId).is("ended_at", null));
  },
  async monitorDue(): Promise<MonitorDue[]> {
    return ((check(await adminClient().rpc("monitor_due")) as Row[] | null) ?? []).map((r) => ({
      workspaceId: s(r.workspace_id), siteId: s(r.site_id), url: s(r.url), siteName: s(r.site_name), status: (r.status as SiteMonitor["status"]) ?? "unknown",
      fails: Number(r.fails ?? 0), sslCheckedAt: (r.ssl_checked_at as string) ?? null, domainCheckedAt: (r.domain_checked_at as string) ?? null,
      domainSource: (r.domain_source as SiteMonitor["domainSource"]) ?? null, emails: (r.emails as string[]) ?? [],
    }));
  },

  // Statistiques sans cookies ------------------------------------------------
  async analyticsOf(workspaceId: string, siteId: string): Promise<SiteAnalytics> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    const r = (check(await sb.from("site_analytics").select("*").eq("site_id", siteId).maybeSingle()) as Row | null)
      ?? one(await adminClient().from("site_analytics").upsert({ site_id: siteId, workspace_id: workspaceId }, { onConflict: "site_id" }).select("*").single());
    return { siteId: s(r.site_id), siteKey: s(r.site_key), enabled: r.enabled !== false, lastHitAt: (r.last_hit_at as string) ?? null };
  },
  async saveAnalytics(workspaceId: string, siteId: string, patch: { enabled: boolean }) {
    await siteOf(workspaceId, siteId);
    check(await adminClient().from("site_analytics").update({ enabled: patch.enabled }).eq("site_id", siteId).eq("workspace_id", workspaceId));
  },
  /** Page vue reçue du script (serveur seulement). false : clé inconnue, mesure arrêtée, plafond du jour. */
  async analyticsHit(h: { key: string; visitor: string; path: string; source: string; device: string; country: string }): Promise<boolean> {
    return Boolean(check(await adminClient().rpc("analytics_hit", { p_key: h.key, p_visitor: h.visitor, p_path: h.path, p_source: h.source, p_device: h.device, p_country: h.country })));
  },
  async statsDays(workspaceId: string, siteId: string, since: string): Promise<StatsDay[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.from("analytics_days").select("day, visitors, pageviews").eq("site_id", siteId).gte("day", since).order("day").limit(800)) as Row[] | null) ?? [])
      .map((r) => ({ day: s(r.day), visitors: Number(r.visitors), pageviews: Number(r.pageviews) }));
  },
  async statsTop(workspaceId: string, siteId: string, since: string, kind: StatsKind, limit = 8): Promise<TopRow[]> {
    await siteOf(workspaceId, siteId);
    const sb = await userClient();
    return ((check(await sb.rpc("analytics_top", { p_site: siteId, p_since: since, p_kind: kind, p_limit: limit })) as Row[] | null) ?? [])
      .map((r) => ({ value: s(r.value), count: Number(r.count), share: Number(r.total) ? Math.round((Number(r.count) / Number(r.total)) * 100) : 0 }));
  },
  async analyticsPurge() {
    check(await adminClient().rpc("analytics_purge"));
  },

  // Publication automatique (tâche de fond, service_role) -------------------
  async automationDue(): Promise<DueTopic[]> {
    return ((check(await adminClient().rpc("automation_due")) as Row[] | null) ?? []).map((r) => ({
      workspaceId: s(r.workspace_id), siteId: s(r.site_id), itemId: s(r.item_id), scheduledFor: s(r.scheduled_for),
      publishTime: s(r.publish_time), timezone: s(r.timezone), articlesLeft: Number(r.articles_left),
    }));
  },
  /** Réserve un sujet pour l'écrire : un seul passage peut le prendre. */
  async claimTopic(workspaceId: string, itemId: string): Promise<boolean> {
    const rows = check(await adminClient().from("calendar_items").update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", itemId).eq("workspace_id", workspaceId).in("status", ["approved", "generating"]).select("id")) as Row[] | null;
    return Boolean(rows?.length);
  },
  /** Rend le sujet après un échec : il sera repris au passage suivant. */
  async releaseTopic(workspaceId: string, itemId: string) {
    check(await adminClient().from("calendar_items").update({ status: "approved" }).eq("id", itemId).eq("workspace_id", workspaceId).eq("status", "generating"));
  },

  // Image des articles (stockage public, écrit par le serveur seulement) ------
  async storeArticleImage(workspaceId: string, articleId: string, bytes: Uint8Array, contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
    if (!(await this.getArticle(workspaceId, articleId))) throw new AccessDenied();
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${workspaceId}/${articleId}-${Date.now().toString(36)}.${ext}`;
    const up = await adminClient().storage.from("article-images").upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });
    if (up.error) throw new Error(up.error.message);
    return `${supabaseUrl()}/storage/v1/object/public/article-images/${path}`;
  },
  /** L'image précédente de notre stockage est effacée quand elle est remplacée ou retirée. */
  async setArticleImage(workspaceId: string, articleId: string, img: { imageUrl: string | null; imageAlt: string; imagePrompt: string | null; imageDemo: boolean }, countGeneration: boolean) {
    const a = await this.getArticle(workspaceId, articleId);
    if (!a) throw new AccessDenied();
    const ad = adminClient();
    check(await ad.from("articles").update({
      image_url: img.imageUrl, image_alt: img.imageAlt, image_prompt: img.imagePrompt, image_demo: img.imageDemo,
      image_generations: a.imageGenerations + (countGeneration ? 1 : 0),
    }).eq("id", articleId).eq("workspace_id", workspaceId));
    const prefix = `${supabaseUrl()}/storage/v1/object/public/article-images/${workspaceId}/`;
    if (a.imageUrl && a.imageUrl !== img.imageUrl && a.imageUrl.startsWith(prefix) && !a.imageUrl.includes("..")) {
      await ad.storage.from("article-images").remove([`${workspaceId}/${a.imageUrl.slice(prefix.length)}`]).catch(() => undefined);
    }
  },
};



