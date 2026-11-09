import "server-only";
import { encryptSecret, toBytea, fromBytea, decryptSecret } from "@/lib/crypto";
import { adminClient, userClient } from "@/lib/supabase/server";
import type { Article, CalendarItem, Competitor, Integration, Publication, Site, Subscription, User, Workspace } from "@/lib/domain/types";
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
  tone: s(r.tone), customInstructions: s(r.custom_instructions), mentionCompetitors: Boolean(r.mention_competitors),
  publishTime: s(r.publish_time).slice(0, 5), timezone: s(r.timezone), publishDays: (r.publish_days as number[]) ?? [],
  publishMode: r.publish_mode === "publish" ? "publish" : "draft", targetWords: Number(r.target_words),
  onboardingStep: Number(r.onboarding_step), analyzedAt: (r.analyzed_at as string) ?? null, createdAt: s(r.created_at),
});

const SITE_COLS: Record<string, string> = {
  url: "url", name: "name", theme: "theme", language: "language", businessDescription: "business_description",
  targetAudience: "target_audience", tone: "tone", customInstructions: "custom_instructions", mentionCompetitors: "mention_competitors",
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
  status: r.status as Article["status"], demo: Boolean(r.demo), publishedAt: (r.published_at as string) ?? null,
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
  remoteUrl: (r.remote_url as string) ?? null, status: r.status as Publication["status"], error: (r.last_error as string) ?? null,
  lastAttemptAt: s(r.last_attempt_at ?? r.updated_at),
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
      workspace_id: workspaceId, article_id: p.articleId, integration_id: p.integrationId, remote_id: p.remoteId, remote_url: p.remoteUrl,
      status: p.status, last_error: p.error, last_attempt_at: p.lastAttemptAt,
    }, { onConflict: "article_id,integration_id" }).select("*").single());
    return toPublication(row);
  },
};
