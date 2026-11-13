import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Branding, ReportDue, SiteReport, IndexingDue, IndexNowSubmission, RankCheck, RankDue, RankKeyword, SiteIndexing, UrlInspection, MonitorDay, MonitorDue, MonitorIncident, SiteMonitor, AiCheck, AiDueSite, AiPlan, AiQuestion, AiRun, Article, AuditRun, CalendarItem, Competitor, Integration, Publication, SearchConnection, SearchReport, Site, Subscription, User, Workspace } from "@/lib/domain/types";
import { AI_PLANS, weekOf } from "@/lib/geo/analyze";
import { RANK_PLANS } from "@/lib/rank/serp";
import { SITE_LIMITS } from "@/lib/domain/plan-limits";
import { localDate } from "@/lib/domain/dates";

/**
 * Couche de données en MODE DÉMO : un fichier JSON local (.data/demo.json), un seul processus.
 * Mêmes règles que la base (supabase/migrations) : chaque lecture et écriture vérifie l'espace
 * (comme la RLS), un sujet par jour et par site, un article par sujet, quota d'articles.
 * supabase-store.ts offre les mêmes fonctions sur Supabase ; store.ts choisit selon la configuration.
 * Ne convient pas à la production (Vercel n'a pas de disque persistant).
 */

type Membership = { userId: string; workspaceId: string; role: "owner" | "admin" | "member" };
type Doc = {
  users: User[];
  workspaces: Workspace[];
  memberships: Membership[];
  subscriptions: Subscription[];
  sites: Site[];
  competitors: Competitor[];
  calendar: CalendarItem[];
  articles: Article[];
  integrations: Integration[];
  publications: Publication[];
  audits: AuditRun[];
  search: Array<SearchConnection & { report: SearchReport | null }>;
  aiQuestions: AiQuestion[];
  aiRuns: AiRun[];
  aiChecks: AiCheck[];
  monitors: SiteMonitor[];
  monitorDays: Array<MonitorDay & { siteId: string }>;
  incidents: MonitorIncident[];
  rankKeywords: RankKeyword[];
  rankChecks: RankCheck[];
  indexing: SiteIndexing[];
  submissions: IndexNowSubmission[];
  inspections: UrlInspection[];
  branding: Array<Branding & { workspaceId: string }>;
  reports: SiteReport[];
};

const EMPTY: Doc = { users: [], workspaces: [], memberships: [], subscriptions: [], sites: [], competitors: [], calendar: [], articles: [], integrations: [], publications: [], audits: [], search: [], aiQuestions: [], aiRuns: [], aiChecks: [], monitors: [], monitorDays: [], incidents: [], rankKeywords: [], rankChecks: [], indexing: [], submissions: [], inspections: [], branding: [], reports: [] };
const FILE = process.env.ALTISEO_DEMO_FILE ?? path.join(process.cwd(), ".data", "demo.json");

import type { DueTopic } from "@/lib/jobs/select";
import { AccessDenied, Conflict, QuotaReached } from "./errors";

// Next.js peut charger ce module plusieurs fois (un exemplaire par groupe de pages) : le cache et la
// file d'écriture vivent donc sur globalThis, et le fichier est relu dès qu'il a changé sur le disque.
type Shared = { doc: Doc | null; mtimeMs: number; chain: Promise<unknown> };
const G = globalThis as typeof globalThis & { __altiseoDemoStore?: Shared };
const shared: Shared = (G.__altiseoDemoStore ??= { doc: null, mtimeMs: -1, chain: Promise.resolve() });

async function load(): Promise<Doc> {
  let mtimeMs = 0;
  try {
    mtimeMs = (await fs.stat(FILE)).mtimeMs;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (shared.doc && shared.mtimeMs === mtimeMs) return shared.doc;
  shared.doc = mtimeMs ? ({ ...structuredClone(EMPTY), ...JSON.parse(await fs.readFile(FILE, "utf8")) } as Doc) : structuredClone(EMPTY);
  shared.mtimeMs = mtimeMs;
  return shared.doc;
}

async function save(doc: Doc) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(doc, null, 1));
  await fs.rename(tmp, FILE);
  shared.doc = doc;
  shared.mtimeMs = (await fs.stat(FILE)).mtimeMs;
}

/** Lecture seule. */
async function read<T>(fn: (d: Doc) => T): Promise<T> {
  await shared.chain;
  return structuredClone(fn(await load()));
}

/** Écriture : une à la fois (comme une transaction), tout ou rien. */
function write<T>(fn: (d: Doc) => T): Promise<T> {
  const run = shared.chain.then(async () => {
    const draft = structuredClone(await load());
    const out = fn(draft);
    await save(draft);
    return structuredClone(out);
  });
  shared.chain = run.catch(() => undefined);
  return run;
}

const now = () => new Date().toISOString();

const newMonitor = (siteId: string): SiteMonitor => ({
  siteId, enabled: true, status: "unknown", fails: 0, lastCheckedAt: null, lastStatusCode: null, lastMs: null, lastError: null, downSince: null,
  sslExpiresAt: null, sslCheckedAt: null, domainExpiresOn: null, domainSource: null, domainCheckedAt: null, alertEmails: [], alertsSent: {},
});

/** Lundi de la semaine, à Zurich (comme la base). */
const mondayOf = (at: Date) => weekOf(localDate(at, "Europe/Zurich"));

function siteOf(d: Doc, siteId: string, workspaceId: string): Site {
  const s = d.sites.find((x) => x.id === siteId);
  if (!s || s.workspaceId !== workspaceId) throw new AccessDenied();
  return s;
}

function periodStart(sub: Subscription): string {
  return sub.currentPeriodStart.slice(0, 10);
}

function articlesUsedIn(d: Doc, workspaceId: string, sub: Subscription): number {
  const sites = new Set(d.sites.filter((s) => s.workspaceId === workspaceId).map((s) => s.id));
  const from = periodStart(sub);
  return d.articles.filter((a) => sites.has(a.siteId) && a.createdAt.slice(0, 10) >= from).length;
}

// ---------------------------------------------------------------------------
// Comptes et espaces
// ---------------------------------------------------------------------------

export const demoDb = {
  async findUserByEmail(email: string) {
    return read((d) => d.users.find((u) => u.email === email.toLowerCase()) ?? null);
  },
  async getUser(id: string) {
    return read((d) => d.users.find((u) => u.id === id) ?? null);
  },
  /** Crée le compte, son espace et un essai de 3 jours (30 articles). */
  async createAccount(email: string, name: string | null) {
    return write((d) => {
      const e = email.toLowerCase();
      if (d.users.some((u) => u.email === e)) throw new Conflict("Un compte existe déjà avec cet e-mail.");
      const user: User = { id: randomUUID(), email: e, name, createdAt: now() };
      const ws: Workspace = { id: randomUUID(), name: name ? `Espace de ${name}` : e, createdAt: now() };
      d.users.push(user);
      d.workspaces.push(ws);
      d.memberships.push({ userId: user.id, workspaceId: ws.id, role: "owner" });
      d.subscriptions.push({
        workspaceId: ws.id, planCode: "grow", status: "trialing",
        trialEndsAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
        currentPeriodStart: now(), articlesPerMonth: 30,
      });
      return { user, workspace: ws };
    });
  },
  async workspaceOf(userId: string) {
    return read((d) => {
      const m = d.memberships.find((x) => x.userId === userId);
      return m ? d.workspaces.find((w) => w.id === m.workspaceId) ?? null : null;
    });
  },
  async subscription(workspaceId: string) {
    return read((d) => {
      const sub = d.subscriptions.find((s) => s.workspaceId === workspaceId) ?? null;
      return sub ? { ...sub, used: articlesUsedIn(d, workspaceId, sub) } : null;
    });
  },

  // -------------------------------------------------------------------------
  // Sites
  // -------------------------------------------------------------------------

  async listSites(workspaceId: string) {
    return read((d) => d.sites.filter((s) => s.workspaceId === workspaceId));
  },
  async getSite(workspaceId: string, siteId: string) {
    return read((d) => siteOf(d, siteId, workspaceId));
  },
  async createSite(workspaceId: string, data: Omit<Site, "id" | "workspaceId" | "createdAt">) {
    return write((d) => {
      if (d.sites.some((s) => s.workspaceId === workspaceId && s.url === data.url)) throw new Conflict("Ce site est déjà dans votre espace.");
      const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId);
      if (sub && d.sites.filter((s) => s.workspaceId === workspaceId).length >= (SITE_LIMITS[sub.planCode] ?? 1)) throw new QuotaReached();
      const site: Site = { ...data, id: randomUUID(), workspaceId, createdAt: now() };
      d.sites.push(site);
      return site;
    });
  },
  async updateSite(workspaceId: string, siteId: string, patch: Partial<Omit<Site, "id" | "workspaceId" | "createdAt">>) {
    return write((d) => Object.assign(siteOf(d, siteId, workspaceId), patch));
  },
  async listCompetitors(workspaceId: string, siteId: string) {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.competitors.filter((c) => c.siteId === siteId); });
  },
  async setCompetitors(workspaceId: string, siteId: string, list: Array<{ url: string; name: string }>) {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      d.competitors = d.competitors.filter((c) => c.siteId !== siteId);
      const seen = new Set<string>();
      for (const c of list) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        d.competitors.push({ id: randomUUID(), siteId, url: c.url, name: c.name, source: "manual" });
      }
      return d.competitors.filter((c) => c.siteId === siteId);
    });
  },

  // -------------------------------------------------------------------------
  // Calendrier
  // -------------------------------------------------------------------------

  async listCalendar(workspaceId: string, siteId: string) {
    return read((d) => {
      siteOf(d, siteId, workspaceId);
      return d.calendar.filter((c) => c.siteId === siteId).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    });
  },
  /** Remplace les sujets encore « proposés » ; garde les jours déjà approuvés, écrits ou sautés. */
  async replaceProposed(workspaceId: string, siteId: string, drafts: Array<Pick<CalendarItem, "scheduledFor" | "title" | "angle" | "keyword"> & Partial<Pick<CalendarItem, "searchVolume" | "difficulty">>>) {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      d.calendar = d.calendar.filter((c) => !(c.siteId === siteId && c.status === "proposed"));
      const busy = new Set(d.calendar.filter((c) => c.siteId === siteId).map((c) => c.scheduledFor));
      for (const t of drafts) {
        if (busy.has(t.scheduledFor)) continue; // un sujet par jour et par site
        busy.add(t.scheduledFor);
        d.calendar.push({ ...t, id: randomUUID(), siteId, searchVolume: t.searchVolume ?? null, difficulty: t.difficulty ?? null, status: "proposed", regenerations: 0 });
      }
      return d.calendar.filter((c) => c.siteId === siteId).length;
    });
  },
  async updateCalendarItem(workspaceId: string, itemId: string, fn: (item: CalendarItem) => void) {
    return write((d) => {
      const item = d.calendar.find((c) => c.id === itemId);
      if (!item) throw new AccessDenied();
      siteOf(d, item.siteId, workspaceId);
      fn(item);
      return item;
    });
  },
  async approveAll(workspaceId: string, siteId: string) {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      let n = 0;
      for (const c of d.calendar) if (c.siteId === siteId && c.status === "proposed") { c.status = "approved"; n++; }
      return n;
    });
  },

  // -------------------------------------------------------------------------
  // Articles
  // -------------------------------------------------------------------------

  async listArticles(workspaceId: string, siteId: string) {
    return read((d) => {
      siteOf(d, siteId, workspaceId);
      return d.articles.filter((a) => a.siteId === siteId && a.status !== "archived").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  },
  async getArticle(workspaceId: string, articleId: string) {
    return read((d) => {
      const a = d.articles.find((x) => x.id === articleId);
      if (!a) return null;
      siteOf(d, a.siteId, workspaceId);
      return a;
    });
  },
  /** Crée l'article d'un sujet : un seul par sujet, dans la limite du quota de la période. */
  async createArticle(workspaceId: string, data: Omit<Article, "id" | "createdAt" | "updatedAt">, _cost?: { inputTokens: number; outputTokens: number; microUsd: number }) {
    return write((d) => {
      siteOf(d, data.siteId, workspaceId);
      const sub = d.subscriptions.find((s) => s.workspaceId === workspaceId && (s.status === "trialing" || s.status === "active"));
      if (!sub) throw new QuotaReached();
      if (articlesUsedIn(d, workspaceId, sub) >= sub.articlesPerMonth) throw new QuotaReached();
      if (data.calendarItemId && d.articles.some((a) => a.calendarItemId === data.calendarItemId)) throw new Conflict("Ce sujet a déjà son article.");
      if (d.articles.some((a) => a.siteId === data.siteId && a.slug === data.slug)) throw new Conflict("Ce slug existe déjà.");
      const a: Article = { ...data, id: randomUUID(), createdAt: now(), updatedAt: now() };
      d.articles.push(a);
      if (data.calendarItemId) {
        const item = d.calendar.find((c) => c.id === data.calendarItemId);
        if (item) item.status = "done";
      }
      return a;
    });
  },
  async updateArticle(workspaceId: string, articleId: string, patch: Partial<Omit<Article, "id" | "siteId" | "createdAt">>) {
    return write((d) => {
      const a = d.articles.find((x) => x.id === articleId);
      if (!a) throw new AccessDenied();
      siteOf(d, a.siteId, workspaceId);
      if (patch.slug && patch.slug !== a.slug && d.articles.some((x) => x.siteId === a.siteId && x.slug === patch.slug)) throw new Conflict("Ce slug existe déjà sur le site.");
      Object.assign(a, patch, { updatedAt: now() });
      return a;
    });
  },
  async slugsOf(workspaceId: string, siteId: string) {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.articles.filter((a) => a.siteId === siteId).map((a) => a.slug); });
  },

  // -------------------------------------------------------------------------
  // Intégrations et publications
  // -------------------------------------------------------------------------

  async listIntegrations(workspaceId: string, siteId: string) {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.integrations.filter((i) => i.siteId === siteId && i.status !== "disabled"); });
  },
  /** Une seule intégration active par site : la nouvelle remplace l'ancienne. */
  async saveIntegration(workspaceId: string, siteId: string, data: Omit<Integration, "id" | "siteId">, _secret?: string) {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      for (const i of d.integrations) if (i.siteId === siteId && i.status !== "disabled") i.status = "disabled";
      const i: Integration = { ...data, id: randomUUID(), siteId };
      d.integrations.push(i);
      return i;
    });
  },
  /** Mode démo : aucun secret n'est gardé. */
  async integrationSecret(_workspaceId: string, _integrationId: string): Promise<string | null> {
    return null;
  },
  async disableIntegration(workspaceId: string, integrationId: string) {
    return write((d) => {
      const i = d.integrations.find((x) => x.id === integrationId);
      if (!i) throw new AccessDenied();
      siteOf(d, i.siteId, workspaceId);
      i.status = "disabled";
      i.config = {};
    });
  },
  async publicationOf(workspaceId: string, articleId: string) {
    return read((d) => {
      const a = d.articles.find((x) => x.id === articleId);
      if (!a) return null;
      siteOf(d, a.siteId, workspaceId);
      return d.publications.filter((p) => p.articleId === articleId).sort((x, y) => y.lastAttemptAt.localeCompare(x.lastAttemptAt))[0] ?? null;
    });
  },
  /** Un billet par article et par intégration : republier met à jour le même. */
  async recordPublication(workspaceId: string, p: Omit<Publication, "id">) {
    return write((d) => {
      const a = d.articles.find((x) => x.id === p.articleId);
      if (!a) throw new AccessDenied();
      siteOf(d, a.siteId, workspaceId);
      const existing = d.publications.find((x) => x.articleId === p.articleId && x.integrationId === p.integrationId);
      if (existing) Object.assign(existing, p);
      else d.publications.push({ ...p, id: randomUUID() });
      return existing ?? d.publications[d.publications.length - 1];
    });
  },

  // -------------------------------------------------------------------------
  // Audit
  // -------------------------------------------------------------------------

  async saveAudit(workspaceId: string, siteId: string, run: Omit<AuditRun, "id" | "siteId" | "createdAt">) {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      const a: AuditRun = { ...run, id: randomUUID(), siteId, createdAt: now() };
      d.audits.push(a);
      return a;
    });
  },
  async latestAudit(workspaceId: string, siteId: string) {
    return read((d) => {
      siteOf(d, siteId, workspaceId);
      return d.audits.filter((a) => a.siteId === siteId).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0] ?? null;
    });
  },

  // -------------------------------------------------------------------------
  // Mots-clés (Google Search Console)
  // -------------------------------------------------------------------------

  async searchConnection(workspaceId: string, siteId: string): Promise<SearchConnection | null> {
    return read((d) => {
      siteOf(d, siteId, workspaceId);
      const c = d.search.find((x) => x.siteId === siteId);
      if (!c) return null;
      const { report: _r, ...rest } = c;
      return rest;
    });
  },
  async searchReport(workspaceId: string, siteId: string): Promise<SearchReport | null> {
    return read((d) => {
      siteOf(d, siteId, workspaceId);
      return d.search.find((x) => x.siteId === siteId)?.report ?? null;
    });
  },
  async saveSearchConnection(workspaceId: string, siteId: string, data: { property: string; demo: boolean }, _secret?: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.search = d.search.filter((x) => x.siteId !== siteId);
      d.search.push({ siteId, property: data.property, demo: data.demo, status: "ok", lastError: null, lastSyncedAt: null, report: null });
    });
  },
  async searchSecret(_workspaceId: string, _siteId: string): Promise<string | null> {
    return null;
  },
  async saveSearchReport(workspaceId: string, siteId: string, report: SearchReport) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      const c = d.search.find((x) => x.siteId === siteId);
      if (c) Object.assign(c, { report, status: "ok", lastError: null, lastSyncedAt: now() });
    });
  },
  async markSearchError(workspaceId: string, siteId: string, error: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      const c = d.search.find((x) => x.siteId === siteId);
      if (c) Object.assign(c, { status: "error", lastError: error });
    });
  },
  async removeSearchConnection(workspaceId: string, siteId: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.search = d.search.filter((x) => x.siteId !== siteId);
    });
  },

  // -------------------------------------------------------------------------
  // Visibilité IA
  // -------------------------------------------------------------------------

  async aiPlan(workspaceId: string): Promise<AiPlan> {
    return read((d) => {
      const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId);
      const p = sub ? AI_PLANS[sub.planCode] : null;
      return p ? { maxQuestions: p.maxQuestions, engines: [...p.engines] } : { maxQuestions: 0, engines: [] };
    });
  },
  async listAiQuestions(workspaceId: string, siteId: string): Promise<AiQuestion[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.aiQuestions.filter((q) => q.siteId === siteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); });
  },
  async addAiQuestions(workspaceId: string, siteId: string, items: Array<{ question: string; source: AiQuestion["source"] }>): Promise<number> {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId);
      if (!sub) throw new QuotaReached();
      const max = AI_PLANS[sub.planCode]?.maxQuestions ?? 0;
      let n = 0;
      for (const it of items) {
        const mine = d.aiQuestions.filter((q) => q.siteId === siteId);
        if (mine.some((q) => q.question === it.question)) continue;
        if (mine.length >= max) break;
        d.aiQuestions.push({ id: randomUUID(), siteId, question: it.question, source: it.source, createdAt: new Date(Date.now() + n).toISOString() });
        n++;
      }
      return n;
    });
  },
  async removeAiQuestion(workspaceId: string, siteId: string, questionId: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.aiQuestions = d.aiQuestions.filter((q) => !(q.id === questionId && q.siteId === siteId));
      d.aiChecks = d.aiChecks.filter((c) => c.questionId !== questionId);
    });
  },
  async listAiRuns(workspaceId: string, siteId: string, limit = 8): Promise<AiRun[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.aiRuns.filter((r) => r.siteId === siteId).sort((a, b) => b.week.localeCompare(a.week)).slice(0, limit); });
  },
  async claimAiRun(workspaceId: string, siteId: string, week: string, demo: boolean): Promise<AiRun | null> {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      const cur = d.aiRuns.find((r) => r.siteId === siteId && r.week === week);
      if (cur) return cur.status === "running" ? cur : null;
      const run: AiRun = { id: randomUUID(), siteId, week, status: "running", readiness: null, error: null, demo, startedAt: now(), finishedAt: null };
      d.aiRuns.push(run);
      return run;
    });
  },
  async updateAiRun(workspaceId: string, siteId: string, runId: string, patch: Partial<Pick<AiRun, "status" | "readiness" | "error">> & { finished?: boolean }) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      const r = d.aiRuns.find((x) => x.id === runId && x.siteId === siteId);
      if (!r) return;
      const { finished, ...rest } = patch;
      Object.assign(r, rest, finished ? { finishedAt: now() } : {});
    });
  },
  async listAiChecks(workspaceId: string, siteId: string, weeks: string[]): Promise<AiCheck[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.aiChecks.filter((c) => c.siteId === siteId && weeks.includes(c.week)); });
  },
  async saveAiCheck(workspaceId: string, siteId: string, c: Omit<AiCheck, "id" | "siteId" | "checkedAt">) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.aiChecks = d.aiChecks.filter((x) => !(x.questionId === c.questionId && x.engine === c.engine && x.week === c.week));
      d.aiChecks.push({ ...c, id: randomUUID(), siteId, checkedAt: now() });
    });
  },
  async aiVisibilityDue(): Promise<AiDueSite[]> {
    return read((d) => {
      const week = mondayOf(new Date());
      const out: AiDueSite[] = [];
      for (const site of d.sites) {
        const sub = d.subscriptions.find((x) => x.workspaceId === site.workspaceId);
        if (!sub || site.onboardingStep < 8) continue;
        const live = sub.status === "active" || (sub.status === "trialing" && (!sub.trialEndsAt || sub.trialEndsAt > now()));
        const plan = AI_PLANS[sub.planCode];
        if (!live || !plan || !d.aiQuestions.some((q) => q.siteId === site.id)) continue;
        if (d.aiRuns.some((r) => r.siteId === site.id && r.week === week && r.status !== "running")) continue;
        out.push({ workspaceId: site.workspaceId, siteId: site.id, maxQuestions: plan.maxQuestions, engines: [...plan.engines] });
      }
      return out;
    });
  },

  // -------------------------------------------------------------------------
  // Offre Agence
  // -------------------------------------------------------------------------

  async sitesAllowed(workspaceId: string): Promise<number> {
    return read((d) => { const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId); return sub ? SITE_LIMITS[sub.planCode] ?? 1 : 1; });
  },
  async branding(workspaceId: string): Promise<Branding> {
    return read((d) => { const b = d.branding.find((x) => x.workspaceId === workspaceId); return b ? { agencyName: b.agencyName, logoUrl: b.logoUrl, accent: b.accent, contact: b.contact } : { agencyName: "", logoUrl: null, accent: null, contact: "" }; });
  },
  async saveBranding(workspaceId: string, b: Branding) {
    await write((d) => {
      d.branding = d.branding.filter((x) => x.workspaceId !== workspaceId);
      d.branding.push({ ...b, workspaceId });
    });
  },
  async reportOf(workspaceId: string, siteId: string): Promise<SiteReport> {
    const found = await read((d) => { siteOf(d, siteId, workspaceId); return d.reports.find((x) => x.siteId === siteId) ?? null; });
    if (found) return found;
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      let r = d.reports.find((x) => x.siteId === siteId);
      if (!r) { r = { siteId, token: (randomUUID() + randomUUID()).replace(/-/g, ""), shared: false, clientName: "", clientEmails: [], monthly: false, lastSentMonth: null }; d.reports.push(r); }
      return r;
    });
  },
  async saveReport(workspaceId: string, siteId: string, patch: Partial<Pick<SiteReport, "shared" | "clientName" | "clientEmails" | "monthly" | "lastSentMonth">> & { newToken?: boolean }) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      const r = d.reports.find((x) => x.siteId === siteId);
      if (!r) return;
      const { newToken, ...rest } = patch;
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
      if (newToken) r.token = (randomUUID() + randomUUID()).replace(/-/g, "");
    });
  },
  async reportByToken(token: string): Promise<{ workspaceId: string; siteId: string } | null> {
    return read((d) => {
      const r = d.reports.find((x) => x.token === token && x.shared);
      const site = r && d.sites.find((x) => x.id === r.siteId);
      return r && site ? { workspaceId: site.workspaceId, siteId: site.id } : null;
    });
  },
  async reportsDue(): Promise<ReportDue[]> {
    return read((d) => {
      const month = mondayOf(new Date()).slice(0, 8) + "01";
      return d.reports.filter((r) => r.monthly && r.shared && r.clientEmails.length && (!r.lastSentMonth || r.lastSentMonth < month)).map((r) => ({
        workspaceId: d.sites.find((x) => x.id === r.siteId)?.workspaceId ?? "", siteId: r.siteId, token: r.token, clientName: r.clientName, emails: r.clientEmails,
      })).filter((x) => x.workspaceId);
    });
  },

  // -------------------------------------------------------------------------
  // Positions Google
  // -------------------------------------------------------------------------

  async rankPlan(workspaceId: string): Promise<number> {
    return read((d) => { const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId); return sub ? RANK_PLANS[sub.planCode] ?? 0 : 0; });
  },
  async listRankKeywords(workspaceId: string, siteId: string): Promise<RankKeyword[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.rankKeywords.filter((k) => k.siteId === siteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); });
  },
  async addRankKeywords(workspaceId: string, siteId: string, items: Array<{ phrase: string; source: RankKeyword["source"] }>): Promise<number> {
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      const sub = d.subscriptions.find((x) => x.workspaceId === workspaceId);
      if (!sub) throw new QuotaReached();
      const max = RANK_PLANS[sub.planCode] ?? 0;
      let n = 0;
      for (const it of items) {
        const mine = d.rankKeywords.filter((k) => k.siteId === siteId);
        if (mine.some((k) => k.phrase.toLowerCase() === it.phrase.toLowerCase())) continue;
        if (mine.length >= max) break;
        d.rankKeywords.push({ id: randomUUID(), siteId, phrase: it.phrase, source: it.source, createdAt: new Date(Date.now() + n).toISOString() });
        n++;
      }
      return n;
    });
  },
  async removeRankKeyword(workspaceId: string, siteId: string, keywordId: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.rankKeywords = d.rankKeywords.filter((k) => !(k.id === keywordId && k.siteId === siteId));
      d.rankChecks = d.rankChecks.filter((c) => c.keywordId !== keywordId);
    });
  },
  async listRankChecks(workspaceId: string, siteId: string, weeks: string[]): Promise<RankCheck[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.rankChecks.filter((c) => c.siteId === siteId && weeks.includes(c.week)); });
  },
  async rankWeeks(workspaceId: string, siteId: string, limit = 12): Promise<string[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return [...new Set(d.rankChecks.filter((c) => c.siteId === siteId).map((c) => c.week))].sort().reverse().slice(0, limit); });
  },
  async saveRankCheck(workspaceId: string, siteId: string, c: Omit<RankCheck, "id" | "siteId" | "checkedAt">) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.rankChecks = d.rankChecks.filter((x) => !(x.keywordId === c.keywordId && x.week === c.week));
      d.rankChecks.push({ ...c, id: randomUUID(), siteId, checkedAt: now() });
    });
  },
  async rankDue(): Promise<RankDue[]> {
    return read((d) => {
      const week = mondayOf(new Date());
      const out: RankDue[] = [];
      for (const site of d.sites) {
        const sub = d.subscriptions.find((x) => x.workspaceId === site.workspaceId);
        if (!sub || site.onboardingStep < 8) continue;
        const live = sub.status === "active" || (sub.status === "trialing" && (!sub.trialEndsAt || sub.trialEndsAt > now()));
        const max = RANK_PLANS[sub.planCode] ?? 0;
        const missing = d.rankKeywords.some((k) => k.siteId === site.id && !d.rankChecks.some((c) => c.keywordId === k.id && c.week === week));
        if (live && max && missing) out.push({ workspaceId: site.workspaceId, siteId: site.id, maxKeywords: max });
      }
      return out;
    });
  },

  // -------------------------------------------------------------------------
  // Indexation (IndexNow + inspection d'URL)
  // -------------------------------------------------------------------------

  async indexingOf(workspaceId: string, siteId: string): Promise<SiteIndexing> {
    const found = await read((d) => { siteOf(d, siteId, workspaceId); return d.indexing.find((x) => x.siteId === siteId) ?? null; });
    if (found) return found;
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      let x = d.indexing.find((y) => y.siteId === siteId);
      if (!x) { x = { siteId, indexnowKey: randomUUID().replace(/-/g, ""), keyVerifiedAt: null, keyError: null, autoSubmit: true }; d.indexing.push(x); }
      return x;
    });
  },
  async saveIndexing(workspaceId: string, siteId: string, patch: Partial<Pick<SiteIndexing, "keyVerifiedAt" | "keyError" | "autoSubmit">>) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      const x = d.indexing.find((y) => y.siteId === siteId);
      if (x) for (const [k, v] of Object.entries(patch)) if (v !== undefined) (x as Record<string, unknown>)[k] = v;
    });
  },
  async addSubmission(workspaceId: string, siteId: string, x: Omit<IndexNowSubmission, "id" | "siteId" | "sentAt">) {
    await write((d) => { siteOf(d, siteId, workspaceId); d.submissions.push({ ...x, urls: x.urls.slice(0, 100), id: randomUUID(), siteId, sentAt: now() }); });
  },
  async listSubmissions(workspaceId: string, siteId: string, limit = 10): Promise<IndexNowSubmission[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.submissions.filter((x) => x.siteId === siteId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, limit); });
  },
  async listInspections(workspaceId: string, siteId: string): Promise<UrlInspection[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.inspections.filter((x) => x.siteId === siteId).sort((a, b) => a.url.localeCompare(b.url)); });
  },
  async saveInspection(workspaceId: string, siteId: string, x: Omit<UrlInspection, "id" | "siteId" | "checkedAt">) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      d.inspections = d.inspections.filter((y) => !(y.siteId === siteId && y.url === x.url));
      d.inspections.push({ ...x, id: randomUUID(), siteId, checkedAt: now() });
    });
  },
  async indexingDue(): Promise<IndexingDue[]> {
    return read((d) => d.search.filter((c) => !c.demo).map((c) => ({ workspaceId: d.sites.find((s) => s.id === c.siteId)?.workspaceId ?? "", siteId: c.siteId })).filter((x) => x.workspaceId));
  },

  // -------------------------------------------------------------------------
  // Gardien du site
  // -------------------------------------------------------------------------

  async monitorOf(workspaceId: string, siteId: string): Promise<SiteMonitor> {
    const found = await read((d) => { siteOf(d, siteId, workspaceId); return d.monitors.find((m) => m.siteId === siteId) ?? null; });
    if (found) return found;
    return write((d) => {
      siteOf(d, siteId, workspaceId);
      const m = d.monitors.find((x) => x.siteId === siteId) ?? newMonitor(siteId);
      if (!d.monitors.includes(m)) d.monitors.push(m);
      return m;
    });
  },
  async saveMonitor(workspaceId: string, siteId: string, patch: Partial<Omit<SiteMonitor, "siteId">>) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      let m = d.monitors.find((x) => x.siteId === siteId);
      if (!m) { m = newMonitor(siteId); d.monitors.push(m); }
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (m as Record<string, unknown>)[k] = v;
    });
  },
  async addMonitorDay(workspaceId: string, siteId: string, day: string, failed: boolean, ms: number) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      let row = d.monitorDays.find((x) => x.siteId === siteId && x.day === day);
      if (!row) { row = { siteId, day, checks: 0, failures: 0, totalMs: 0 }; d.monitorDays.push(row); }
      row.checks++;
      if (failed) row.failures++;
      row.totalMs += Math.max(0, Math.round(ms));
    });
  },
  async monitorDays(workspaceId: string, siteId: string, since: string): Promise<MonitorDay[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.monitorDays.filter((x) => x.siteId === siteId && x.day >= since).sort((a, b) => a.day.localeCompare(b.day)).map(({ siteId: _s, ...x }) => x); });
  },
  async monitorIncidents(workspaceId: string, siteId: string, limit = 10): Promise<MonitorIncident[]> {
    return read((d) => { siteOf(d, siteId, workspaceId); return d.incidents.filter((x) => x.siteId === siteId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, limit); });
  },
  async openIncident(workspaceId: string, siteId: string, i: { startedAt: string; statusCode: number | null; error: string | null }) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      if (d.incidents.some((x) => x.siteId === siteId && !x.endedAt)) return;
      d.incidents.push({ id: randomUUID(), siteId, startedAt: i.startedAt, endedAt: null, statusCode: i.statusCode, error: i.error });
    });
  },
  async closeIncident(workspaceId: string, siteId: string, endedAt: string) {
    await write((d) => {
      siteOf(d, siteId, workspaceId);
      for (const x of d.incidents) if (x.siteId === siteId && !x.endedAt) x.endedAt = endedAt;
    });
  },
  async monitorDue(): Promise<MonitorDue[]> {
    return read((d) => {
      const out: MonitorDue[] = [];
      const limit = Date.now() - 4 * 60_000;
      for (const site of d.sites) {
        const sub = d.subscriptions.find((x) => x.workspaceId === site.workspaceId);
        const live = sub && (sub.status === "active" || (sub.status === "trialing" && (!sub.trialEndsAt || sub.trialEndsAt > now())));
        if (!live || site.onboardingStep < 8) continue;
        const m = d.monitors.find((x) => x.siteId === site.id) ?? newMonitor(site.id);
        if (!m.enabled || (m.lastCheckedAt && new Date(m.lastCheckedAt).getTime() > limit)) continue;
        const owners = d.memberships.filter((x) => x.workspaceId === site.workspaceId && x.role !== "member").map((x) => d.users.find((u) => u.id === x.userId)?.email).filter(Boolean) as string[];
        out.push({ workspaceId: site.workspaceId, siteId: site.id, url: site.url, siteName: site.name || site.url, status: m.status, fails: m.fails, sslCheckedAt: m.sslCheckedAt, domainCheckedAt: m.domainCheckedAt, domainSource: m.domainSource, emails: m.alertEmails.length ? m.alertEmails : owners.slice(0, 3) });
      }
      return out;
    });
  },

  // -------------------------------------------------------------------------
  // Publication automatique (tâche de fond)
  // -------------------------------------------------------------------------

  async storeArticleImage(_workspaceId: string, _articleId: string, _bytes: Uint8Array, _contentType: "image/jpeg" | "image/png" | "image/webp"): Promise<string> {
    throw new Error("Le mode démo ne garde pas d'images : il utilise une image d'exemple.");
  },
  async setArticleImage(workspaceId: string, articleId: string, img: { imageUrl: string | null; imageAlt: string; imagePrompt: string | null; imageDemo: boolean }, countGeneration: boolean) {
    await write((d) => {
      const a = d.articles.find((x) => x.id === articleId);
      if (!a) throw new AccessDenied();
      siteOf(d, a.siteId, workspaceId);
      Object.assign(a, img, { imageGenerations: (a.imageGenerations ?? 0) + (countGeneration ? 1 : 0), updatedAt: now() });
    });
  },
  async automationDue(): Promise<DueTopic[]> {
    return read((d) => {
      const out: DueTopic[] = [];
      for (const c of d.calendar) {
        if (c.status !== "approved" && c.status !== "generating") continue;
        if (d.articles.some((a) => a.calendarItemId === c.id)) continue;
        const site = d.sites.find((x) => x.id === c.siteId);
        const sub = site && d.subscriptions.find((x) => x.workspaceId === site.workspaceId);
        if (!site || !sub || site.onboardingStep < 8) continue;
        const live = sub.status === "active" || (sub.status === "trialing" && (!sub.trialEndsAt || sub.trialEndsAt > now()));
        if (!live) continue;
        out.push({ workspaceId: site.workspaceId, siteId: site.id, itemId: c.id, scheduledFor: c.scheduledFor, publishTime: site.publishTime, timezone: site.timezone, articlesLeft: sub.articlesPerMonth - articlesUsedIn(d, site.workspaceId, sub) });
      }
      return out;
    });
  },
  async claimTopic(workspaceId: string, itemId: string): Promise<boolean> {
    return write((d) => {
      const c = d.calendar.find((x) => x.id === itemId);
      if (!c || (c.status !== "approved" && c.status !== "generating")) return false;
      siteOf(d, c.siteId, workspaceId);
      c.status = "generating";
      return true;
    });
  },
  async releaseTopic(workspaceId: string, itemId: string) {
    await write((d) => {
      const c = d.calendar.find((x) => x.id === itemId);
      if (!c || c.status !== "generating") return;
      siteOf(d, c.siteId, workspaceId);
      c.status = "approved";
    });
  },
};

/** Pour les tests : repartir d'un fichier vide. */
export async function resetDemoStore() {
  await write((d) => { Object.assign(d, structuredClone(EMPTY)); });
}
