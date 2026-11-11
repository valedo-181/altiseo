import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Article, AuditRun, CalendarItem, Competitor, Integration, Publication, SearchConnection, SearchReport, Site, Subscription, User, Workspace } from "@/lib/domain/types";

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
};

const EMPTY: Doc = { users: [], workspaces: [], memberships: [], subscriptions: [], sites: [], competitors: [], calendar: [], articles: [], integrations: [], publications: [], audits: [], search: [] };
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
  // Publication automatique (tâche de fond)
  // -------------------------------------------------------------------------

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
