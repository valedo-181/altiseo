import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/data/store";
import { addDays, localDate } from "@/lib/domain/dates";
import { markdownToHtml, wordCount } from "@/lib/domain/markdown";
import { alternativeDemoTopic, planDemoTopics } from "@/lib/domain/plan";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import { MAX_REGENERATIONS, type Site } from "@/lib/domain/types";
import { guessLanguage, normalizeSiteUrl, siteNameFromHost } from "@/lib/domain/url";
import { writeDemoArticle } from "@/lib/domain/write";

/**
 * Opérations métier. Aujourd'hui en MODE DÉMO (pas d'IA, pas d'envoi réel) ; les mêmes fonctions
 * appelleront Claude, DataForSEO et les CMS avec /replica-backend, sans changer les écrans.
 */

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });

/** F01 : le client donne son adresse ; l'analyse (démo) devine le nom et la langue. */
export async function createSiteFromUrl(workspaceId: string, raw: string): Promise<Result<Site>> {
  const u = normalizeSiteUrl(raw);
  if (!u.ok) return fail(u.error);
  const existing = (await db.listSites(workspaceId)).find((s) => s.url === u.url);
  if (existing) return { ok: true, value: existing };
  const site = await db.createSite(workspaceId, {
    url: u.url,
    name: siteNameFromHost(u.host),
    language: guessLanguage(u.host),
    theme: "",
    businessDescription: "",
    targetAudience: "",
    tone: "Clair et professionnel, vouvoiement",
    customInstructions: "",
    mentionCompetitors: false,
    publishTime: "08:00",
    timezone: "Europe/Zurich",
    publishDays: [1, 2, 3, 4, 5, 6, 7],
    publishMode: "draft",
    targetWords: 1500,
    onboardingStep: 2,
    analyzedAt: new Date().toISOString(),
  });
  return { ok: true, value: site };
}

/** F01, F02 : 30 sujets à partir de demain (jour local du site). */
export async function buildCalendar(workspaceId: string, siteId: string): Promise<Result<number>> {
  const site = await db.getSite(workspaceId, siteId);
  if (!site.theme.trim()) return fail("Indiquez d'abord le thème principal de votre site (étape Activité).");
  const from = addDays(localDate(new Date(), site.timezone), 1);
  const existing = await db.listCalendar(workspaceId, siteId);
  const kept = new Set(existing.filter((c) => c.status !== "proposed").map((c) => c.title));
  const topics = planDemoTopics(site.theme, from, 30, site.publishDays, kept);
  const n = await db.replaceProposed(workspaceId, siteId, topics);
  return { ok: true, value: n };
}

export async function regenerateTopic(workspaceId: string, itemId: string): Promise<Result> {
  try {
    let error: string | null = null;
    // Le site et les titres pris sont lus dans la même écriture que la mise à jour.
    const item = await db.updateCalendarItem(workspaceId, itemId, (it) => {
      if (it.status !== "proposed" && it.status !== "approved") error = "Ce sujet est déjà écrit ou sauté.";
      else if (it.regenerations >= MAX_REGENERATIONS) error = `Vous avez déjà changé ce sujet ${MAX_REGENERATIONS} fois.`;
    });
    if (error) return fail(error);
    const site = await db.getSite(workspaceId, item.siteId);
    const taken = new Set((await db.listCalendar(workspaceId, item.siteId)).map((c) => c.title));
    const alt = alternativeDemoTopic(site.theme, item.scheduledFor, taken, item.regenerations + item.title.length);
    if (!alt) return fail("Plus d'autre sujet disponible en mode démo pour ce jour.");
    await db.updateCalendarItem(workspaceId, itemId, (it) => {
      it.title = alt.title; it.angle = alt.angle; it.keyword = alt.keyword;
      it.status = "proposed"; it.regenerations += 1;
    });
    return { ok: true, value: undefined };
  } catch {
    return fail("Sujet introuvable.");
  }
}

export async function setTopicStatus(workspaceId: string, itemId: string, status: "approved" | "skipped" | "proposed"): Promise<Result> {
  let error: string | null = null;
  await db.updateCalendarItem(workspaceId, itemId, (it) => {
    if (it.status === "done" || it.status === "generating") { error = "Ce sujet est déjà écrit."; return; }
    it.status = status;
  });
  return error ? fail(error) : { ok: true, value: undefined };
}

/** F03 (à la demande) : écrit l'article d'un sujet. En démo : texte d'exemple, sans IA. */
export async function writeArticleForTopic(workspaceId: string, itemId: string): Promise<Result<string>> {
  const items = await db.listSites(workspaceId).then(async (sites) => {
    for (const s of sites) {
      const it = (await db.listCalendar(workspaceId, s.id)).find((c) => c.id === itemId);
      if (it) return { site: s, item: it };
    }
    return null;
  });
  if (!items) return fail("Sujet introuvable.");
  const { site, item } = items;
  if (item.status === "done") return fail("Ce sujet a déjà son article.");
  if (item.status === "skipped") return fail("Ce jour est sauté : remettez le sujet avant de l'écrire.");
  const existing = (await db.listArticles(workspaceId, site.id)).map((a) => ({ title: a.title, slug: a.slug }));
  const w = writeDemoArticle({ siteName: site.name, siteUrl: site.url, theme: site.theme, title: item.title, angle: item.angle, keyword: item.keyword, existing });
  const slug = uniqueSlug(slugify(w.title), new Set(await db.slugsOf(workspaceId, site.id)));
  try {
    const a = await db.createArticle(workspaceId, {
      siteId: site.id, calendarItemId: item.id, title: w.title, slug, metaTitle: w.metaTitle, metaDescription: w.metaDescription,
      bodyMd: w.bodyMd, language: site.language, keywords: w.keywords, internalLinks: w.internalLinks, wordCount: w.wordCount,
      status: "draft", demo: true, publishedAt: null, editedAt: null,
    });
    return { ok: true, value: a.id };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export type ArticleEdit = { title: string; slug: string; metaTitle: string; metaDescription: string; bodyMd: string };

export function checkArticleEdit(e: ArticleEdit): string | null {
  if (!e.title.trim()) return "Le titre est obligatoire.";
  if ([...e.title].length > 200) return "Le titre est trop long (200 caractères au plus).";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug)) return "Le slug ne peut contenir que des minuscules, des chiffres et des tirets.";
  if ([...e.metaTitle].length > 70) return "Le titre SEO dépasse 70 caractères.";
  if ([...e.metaDescription].length > 170) return "La description dépasse 170 caractères.";
  if (!e.bodyMd.trim()) return "Le texte de l'article est vide.";
  if (e.bodyMd.length > 100_000) return "Le texte est trop long.";
  return null;
}

export async function saveArticle(workspaceId: string, articleId: string, raw: ArticleEdit): Promise<Result> {
  // Les navigateurs envoient les retours à la ligne des zones de texte en \r\n.
  const e = { ...raw, bodyMd: raw.bodyMd.replace(/\r\n?/g, "\n") };
  const err = checkArticleEdit(e);
  if (err) return fail(err);
  try {
    await db.updateArticle(workspaceId, articleId, { ...e, wordCount: wordCount(e.bodyMd), editedAt: new Date().toISOString() });
    return { ok: true, value: undefined };
  } catch (x) {
    return fail((x as Error).message);
  }
}

/** Mot de passe d'application WordPress : 24 caractères, souvent par groupes de 4 séparés d'espaces. */
export function looksLikeAppPassword(p: string): boolean {
  return /^[A-Za-z0-9]{24}$/.test(p.replace(/\s+/g, ""));
}

/**
 * F05 : connexion WordPress (API REST + mot de passe d'application).
 * En démo : on vérifie la forme des champs, rien n'est envoyé et le mot de passe n'est PAS gardé.
 */
export async function connectWordPress(workspaceId: string, siteId: string, f: { endpoint: string; username: string; appPassword: string }): Promise<Result> {
  const u = normalizeSiteUrl(f.endpoint);
  if (!u.ok) return fail(u.error);
  if (!f.username.trim()) return fail("Indiquez le nom d'utilisateur WordPress.");
  if (!looksLikeAppPassword(f.appPassword)) return fail("Ce n'est pas un mot de passe d'application WordPress (24 lettres et chiffres). Créez-le dans WordPress : Profil → Mots de passe d'application.");
  await db.saveIntegration(workspaceId, siteId, {
    kind: "wordpress", status: "ok", config: { endpoint: u.url, username: f.username.trim() },
    lastError: null, lastTestedAt: new Date().toISOString(), demo: true,
  });
  return { ok: true, value: undefined };
}

/** F04 : envoie l'article au CMS (création, puis mise à jour du même billet). En démo : simulé. */
export async function publishArticle(workspaceId: string, articleId: string): Promise<Result<{ mode: "draft" | "publish"; url: string }>> {
  const a = await db.getArticle(workspaceId, articleId);
  if (!a) return fail("Article introuvable.");
  const site = await db.getSite(workspaceId, a.siteId);
  const integ = (await db.listIntegrations(workspaceId, site.id)).find((i) => i.status === "ok");
  if (!integ) return fail("Connectez d'abord votre site (Intégrations).");
  const html = markdownToHtml(a.bodyMd); // ce qui partira vers le CMS
  const prev = await db.publicationOf(workspaceId, a.id);
  const remoteId = prev?.remoteId ?? `demo-${createHash("sha256").update(a.id).digest("hex").slice(0, 6)}`;
  const base = integ.config.endpoint ?? site.url;
  const url = site.publishMode === "draft" ? `${base}/wp-admin/post.php?post=${remoteId}&action=edit` : `${base}/${a.slug}/`;
  await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId, remoteUrl: url, status: "ok", error: null, lastAttemptAt: new Date().toISOString() });
  await db.updateArticle(workspaceId, a.id, {
    status: site.publishMode === "publish" ? "published" : "draft",
    publishedAt: site.publishMode === "publish" ? (a.publishedAt ?? new Date().toISOString()) : a.publishedAt,
  });
  void html;
  return { ok: true, value: { mode: site.publishMode, url } };
}
