import "server-only";
import { createHash } from "node:crypto";
import { AiError, analyzeSite, planTopics, writeArticle, type SiteBrief } from "@/lib/ai/claude";
import { testWordPress, uploadWordPressMedia, upsertWordPressPost } from "@/lib/cms/wordpress";
import { isBranch, isDir, isRepo, looksLikeGitHubToken, publicArticleUrl, testGitHub, upsertGitHubArticle } from "@/lib/cms/github";
import { config } from "@/lib/config";
import { db } from "@/lib/data/store";
import { scoreSite } from "@/lib/seo/audit";
import { crawlSite, pageSpeed, publicUrl, safeFetch } from "@/lib/seo/crawl";
import { toAuditIssues } from "@/lib/seo/report";
import { htmlToText } from "@/lib/seo/text";
import { addDays, localDate, publishDates } from "@/lib/domain/dates";
import { markdownToHtml, wordCount } from "@/lib/domain/markdown";
import { alternativeDemoTopic, planDemoTopics } from "@/lib/domain/plan";
import { slugify, uniqueSlug } from "@/lib/domain/slug";
import { MAX_REGENERATIONS, type Article, type Integration, type Site } from "@/lib/domain/types";
import { generateImage } from "@/lib/images/higgsfield";
import { buildImagePrompt, imageAlt, isOwnImage, MAX_IMAGE_GENERATIONS } from "@/lib/images/prompt";
import { supabaseUrl } from "@/lib/supabase/url";
import { dailyQueries, dailyTotals, exchangeCode, listProperties, refreshAccess, revokeToken } from "@/lib/search/google";
import { buildReport, CHART_DAYS, matchProperty, PERIOD_DAYS, sampleRows } from "@/lib/search/report";
import { guessLanguage, normalizeSiteUrl, siteNameFromHost } from "@/lib/domain/url";
import { writeDemoArticle } from "@/lib/domain/write";

/**
 * Opérations métier. Chaque service réel prend le relais dès que ses clés sont là (src/lib/config.ts) :
 * Claude pour l'analyse, les sujets et les articles ; WordPress pour l'envoi. Sinon : mode démo.
 * Volume et difficulté des mots-clés : DataForSEO, à brancher.
 */

export async function brief(workspaceId: string, site: Site): Promise<SiteBrief> {
  const competitors = (await db.listCompetitors(workspaceId, site.id)).map((c) => c.url);
  return {
    name: site.name, url: site.url, theme: site.theme, language: site.language, businessDescription: site.businessDescription,
    targetAudience: site.targetAudience, tone: site.tone, customInstructions: site.customInstructions,
    mentionCompetitors: site.mentionCompetitors, competitors, targetWords: site.targetWords,
  };
}

const aiMessage = (e: unknown) => (e instanceof AiError ? e.message : "La rédaction a échoué. Réessayez dans un moment.");

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });

/** F01 : le client donne son adresse ; l'analyse (démo) devine le nom et la langue. */
export async function createSiteFromUrl(workspaceId: string, raw: string): Promise<Result<Site>> {
  const u = normalizeSiteUrl(raw);
  if (!u.ok) return fail(u.error);
  const existing = (await db.listSites(workspaceId)).find((s) => s.url === u.url);
  if (existing) return { ok: true, value: existing };
  // Analyse réelle : page d'accueil lue (adresses publiques seulement) puis décrite par Claude.
  // En cas d'échec, on garde les valeurs devinées depuis le domaine : le client les corrige à l'étape suivante.
  let found: { name: string; theme: string; businessDescription: string; targetAudience: string; tone: string; language: Site["language"] } | null = null;
  if (config.ai) {
    const page = await safeFetch(u.url);
    if (page.status >= 200 && page.status < 300 && "body" in page && page.body) {
      const t = htmlToText(page.body);
      try {
        found = (await analyzeSite({ url: u.url, ...t })).analysis;
      } catch {
        found = null;
      }
    }
  }
  const site = await db.createSite(workspaceId, {
    url: u.url,
    name: found?.name || siteNameFromHost(u.host),
    language: found?.language ?? guessLanguage(u.host),
    theme: found?.theme ?? "",
    businessDescription: found?.businessDescription ?? "",
    targetAudience: found?.targetAudience ?? "",
    tone: found?.tone || "Clair et professionnel, vouvoiement",
    customInstructions: "",
    mentionCompetitors: false, featuredImages: true,
    publishTime: "08:00",
    timezone: "Europe/Zurich",
    publishDays: [1, 2, 3, 4, 5, 6, 7],
    publishMode: "draft",
    targetWords: 1500,
    onboardingStep: 2,
    analyzedAt: found ? new Date().toISOString() : null,
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
  const busy = new Set(existing.filter((c) => c.status !== "proposed").map((c) => c.scheduledFor));
  if (!config.ai) {
    const n = await db.replaceProposed(workspaceId, siteId, planDemoTopics(site.theme, from, 30, site.publishDays, kept));
    return { ok: true, value: n };
  }
  const days = publishDates(from, 30 + busy.size, site.publishDays).filter((d) => !busy.has(d)).slice(0, 30);
  const published = (await db.listArticles(workspaceId, siteId)).map((a) => a.title);
  try {
    const { topics } = await planTopics(await brief(workspaceId, site), days.length, [...kept, ...published]);
    const n = await db.replaceProposed(workspaceId, siteId, topics.map((t, i) => ({ ...t, scheduledFor: days[i] })).filter((t) => t.scheduledFor));
    return { ok: true, value: n };
  } catch (e) {
    return fail(aiMessage(e));
  }
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
    let alt: { title: string; angle: string; keyword: string } | null;
    if (config.ai) {
      try {
        alt = (await planTopics(await brief(workspaceId, site), 1, [...taken])).topics[0] ?? null;
      } catch (e) {
        return fail(aiMessage(e));
      }
    } else {
      alt = alternativeDemoTopic(site.theme, item.scheduledFor, taken, item.regenerations + item.title.length);
    }
    if (!alt) return fail(config.ai ? "Aucun autre sujet n'a été proposé. Réessayez." : "Plus d'autre sujet disponible en mode démo pour ce jour.");
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
  const sub = await db.subscription(workspaceId);
  if (sub && sub.used >= sub.articlesPerMonth) return fail("Quota d'articles atteint pour ce mois."); // avant de payer l'IA
  const articles = await db.listArticles(workspaceId, site.id);
  let w: ReturnType<typeof writeDemoArticle>;
  let cost: { inputTokens: number; outputTokens: number; microUsd: number } | undefined;
  if (config.ai) {
    // Liens internes : articles déjà publiés, à leur adresse sur le site (WordPress ou site statique).
    const integ = (await db.listIntegrations(workspaceId, site.id)).find((i) => i.status === "ok");
    const pages = articles.filter((a) => a.status === "published").map((a) => ({ title: a.title, url: articleUrl(site, integ, a.slug) }));
    try {
      const r = await writeArticle({ site: await brief(workspaceId, site), title: item.title, angle: item.angle, keyword: item.keyword, pages });
      w = r.article;
      cost = r.usage;
    } catch (e) {
      return fail(aiMessage(e));
    }
  } else {
    w = writeDemoArticle({ siteName: site.name, siteUrl: site.url, theme: site.theme, title: item.title, angle: item.angle, keyword: item.keyword, existing: articles.map((a) => ({ title: a.title, slug: a.slug })) });
  }
  const slug = uniqueSlug(slugify(w.title), new Set(await db.slugsOf(workspaceId, site.id)));
  try {
    const a = await db.createArticle(workspaceId, {
      siteId: site.id, calendarItemId: item.id, title: w.title, slug, metaTitle: w.metaTitle, metaDescription: w.metaDescription,
      bodyMd: w.bodyMd, language: site.language, keywords: w.keywords, internalLinks: w.internalLinks, wordCount: w.wordCount,
      status: "draft", demo: !config.ai, publishedAt: null, editedAt: null,
      imageUrl: null, imageAlt: "", imagePrompt: null, imageDemo: false, imageGenerations: 0,
    }, cost);
    // L'image vient après : si elle échoue, l'article est quand même là (bouton « Créer une image »).
    if (site.featuredImages) await illustrateArticle(workspaceId, a.id, { idea: w.imageIdea }).catch((e) => console.error("image.article", e instanceof Error ? e.message : e));
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
 * F05 : connexion WordPress (API REST + mot de passe d'application). Avec la vraie base et
 * ENCRYPTION_KEY : test réel puis mot de passe chiffré. En démo : contrôle de forme, rien n'est gardé.
 */
export async function connectWordPress(workspaceId: string, siteId: string, f: { endpoint: string; username: string; appPassword: string }): Promise<Result> {
  const u = normalizeSiteUrl(f.endpoint);
  if (!u.ok) return fail(u.error);
  if (!f.username.trim()) return fail("Indiquez le nom d'utilisateur WordPress.");
  if (!looksLikeAppPassword(f.appPassword)) return fail("Ce n'est pas un mot de passe d'application WordPress (24 lettres et chiffres). Créez-le dans WordPress : Profil → Mots de passe d'application.");
  if (config.cms) {
    const creds = { endpoint: u.url, username: f.username.trim(), appPassword: f.appPassword };
    const t = await testWordPress(creds);
    if (!t.ok) return fail(t.error);
    await db.saveIntegration(workspaceId, siteId, {
      kind: "wordpress", status: "ok", config: { endpoint: u.url, username: creds.username },
      lastError: null, lastTestedAt: new Date().toISOString(), demo: false,
    }, creds.appPassword.replace(/\s+/g, ""));
    return { ok: true, value: undefined };
  }
  await db.saveIntegration(workspaceId, siteId, {
    kind: "wordpress", status: "ok", config: { endpoint: u.url, username: f.username.trim() },
    lastError: null, lastTestedAt: new Date().toISOString(), demo: true,
  });
  return { ok: true, value: undefined };
}

/** Adresse publique d'un article : « nom-de-l-article/ » sur WordPress, « blog/nom.html » sur un site statique. */
export function articleUrl(site: Pick<Site, "url">, integ: Pick<Integration, "kind" | "config"> | undefined, slug: string): string {
  if (integ?.kind === "github") return publicArticleUrl(integ.config.endpoint ?? site.url, integ.config.dir ?? "blog", slug);
  return `${(integ?.config.endpoint ?? site.url).replace(/\/+$/, "")}/${slug}/`;
}

/**
 * Site statique sur GitHub (ex. domevia.ch sur Vercel) : Altiseo écrit chaque article en JSON dans le
 * dépôt, le site en fait une page à sa mise en ligne. Jeton fine-grained limité au dépôt, chiffré.
 */
export async function connectGitHub(workspaceId: string, siteId: string, f: { siteUrl: string; repo: string; branch: string; dir: string; token: string }): Promise<Result> {
  const u = normalizeSiteUrl(f.siteUrl);
  if (!u.ok) return fail(u.error);
  const repo = f.repo.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  const branch = f.branch.trim() || "main";
  const dir = f.dir.trim().replace(/^\/+|\/+$/g, "") || "blog";
  if (!isRepo(repo)) return fail("Indiquez le dépôt sous la forme propriétaire/dépôt (ex. valedo-181/domevia).");
  if (!isBranch(branch)) return fail("Nom de branche invalide.");
  if (!isDir(dir)) return fail("Dossier invalide : lettres minuscules, chiffres et tirets (ex. blog).");
  if (!looksLikeGitHubToken(f.token)) return fail("Ce n'est pas un jeton GitHub (il commence par github_pat_). Créez-le dans GitHub : Settings → Developer settings → Fine-grained tokens.");
  const cfg = { endpoint: u.url, repo, branch, dir };
  if (config.cms) {
    const t = await testGitHub({ repo, branch, dir, token: f.token.trim() });
    if (!t.ok) return fail(t.error);
    await db.saveIntegration(workspaceId, siteId, { kind: "github", status: "ok", config: cfg, lastError: null, lastTestedAt: new Date().toISOString(), demo: false }, f.token.trim());
    return { ok: true, value: undefined };
  }
  await db.saveIntegration(workspaceId, siteId, { kind: "github", status: "ok", config: cfg, lastError: null, lastTestedAt: new Date().toISOString(), demo: true });
  return { ok: true, value: undefined };
}

/** F04 : envoie l'article au CMS (création, puis mise à jour du même billet). En démo : simulé. */
/** Image d'exemple quand la clé Higgsfield n'est pas là : jamais envoyée au site du client. */
const SAMPLE_IMAGE = "/brand/sommet.jpg";

/**
 * Crée l'image d'illustration d'un article (photo réaliste, 16:9) et la range dans notre stockage.
 * `manual` : demandé par la personne (« Changer l'image »), limité à MAX_IMAGE_GENERATIONS par article.
 */
export async function illustrateArticle(workspaceId: string, articleId: string, opts: { idea?: string; manual?: boolean } = {}): Promise<Result<{ demo: boolean }>> {
  const a = await db.getArticle(workspaceId, articleId);
  if (!a) return fail("Article introuvable.");
  if (opts.manual && a.imageGenerations >= MAX_IMAGE_GENERATIONS) return fail(`Vous avez déjà créé ${MAX_IMAGE_GENERATIONS} images pour cet article.`);
  const site = await db.getSite(workspaceId, a.siteId);
  const alt = imageAlt(a.title);
  if (!config.images) {
    await db.setArticleImage(workspaceId, a.id, { imageUrl: SAMPLE_IMAGE, imageAlt: alt, imagePrompt: null, imageDemo: true }, false); // une image d'exemple ne consomme pas d'essai
    return { ok: true, value: { demo: true } };
  }
  // Une nouvelle demande repart de la même scène ; Higgsfield en donne une autre vue à chaque fois.
  const prompt = a.imagePrompt && !opts.idea ? a.imagePrompt : buildImagePrompt({ idea: opts.idea, title: a.title, theme: site.theme, keyword: a.keywords[0] });
  const img = await generateImage(prompt, {
    keyId: process.env.HIGGSFIELD_KEY_ID ?? "", keySecret: process.env.HIGGSFIELD_KEY_SECRET ?? "",
    model: process.env.HIGGSFIELD_IMAGE_MODEL?.trim(), resolution: process.env.HIGGSFIELD_IMAGE_RESOLUTION?.trim(),
    isPublic: async (u) => Boolean(await publicUrl(u)),
  });
  if (!img.ok) return fail(img.error);
  const url = await db.storeArticleImage(workspaceId, a.id, img.bytes, img.contentType);
  await db.setArticleImage(workspaceId, a.id, { imageUrl: url, imageAlt: alt, imagePrompt: prompt, imageDemo: false }, true);
  return { ok: true, value: { demo: false } };
}

export async function removeArticleImage(workspaceId: string, articleId: string): Promise<Result> {
  const a = await db.getArticle(workspaceId, articleId);
  if (!a) return fail("Article introuvable.");
  await db.setArticleImage(workspaceId, a.id, { imageUrl: null, imageAlt: "", imagePrompt: a.imagePrompt, imageDemo: false }, false);
  return { ok: true, value: undefined };
}

/** Lit une image de notre propre stockage (jamais une autre adresse) pour l'envoyer au CMS. */
async function ownImageBytes(a: Article): Promise<{ bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp" } | null> {
  if (a.imageDemo || !isOwnImage(a.imageUrl, supabaseUrl() ?? null)) return null;
  try {
    const r = await fetch(a.imageUrl, { signal: AbortSignal.timeout(20_000), redirect: "error" });
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!r.ok || (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    return bytes.length && bytes.length <= 10 * 1024 * 1024 ? { bytes, contentType: type } : null;
  } catch {
    return null;
  }
}

export async function publishArticle(workspaceId: string, articleId: string): Promise<Result<{ mode: "draft" | "publish"; url: string; simulated: boolean; imageMissing?: boolean; target?: "github" }>> {
  const a = await db.getArticle(workspaceId, articleId);
  if (!a) return fail("Article introuvable.");
  const site = await db.getSite(workspaceId, a.siteId);
  const integ = (await db.listIntegrations(workspaceId, site.id)).find((i) => i.status === "ok");
  if (!integ) return fail("Connectez d'abord votre site (Intégrations).");
  const html = markdownToHtml(a.bodyMd); // ce qui part vers le CMS
  const prev = await db.publicationOf(workspaceId, a.id);
  if (!integ.demo && config.cms && integ.kind === "github") {
    const token = await db.integrationSecret(workspaceId, integ.id);
    const { repo, branch, dir, endpoint } = integ.config;
    if (!token || !repo || !branch || !dir || !endpoint) return fail("Reconnectez le dépôt GitHub (réglages manquants).");
    const keep = a.imageUrl && !a.imageDemo && prev?.remoteMediaId && prev.remoteMediaSrc === a.imageUrl ? prev.remoteMediaId : null;
    const file = a.imageUrl && !a.imageDemo && !keep ? await ownImageBytes(a) : null;
    const at = new Date().toISOString();
    const draft = site.publishMode === "draft";
    const r = await upsertGitHubArticle({ repo, branch, dir, token }, endpoint, {
      slug: a.slug, title: a.title, metaTitle: a.metaTitle, description: a.metaDescription,
      date: a.publishedAt ?? at, updated: a.publishedAt ? at : null, keyword: a.keywords[0] ?? null, html, draft,
      image: file ? { bytes: file.bytes, ext: file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg", alt: a.imageAlt } : null,
      keepImage: keep,
    }, prev?.remoteId ?? null, prev?.remoteMediaId ?? null);
    if (!r.ok) {
      await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId: prev?.remoteId ?? null, remoteUrl: prev?.remoteUrl ?? null, remoteMediaId: prev?.remoteMediaId ?? null, remoteMediaSrc: prev?.remoteMediaSrc ?? null, status: "error", error: r.error, lastAttemptAt: at });
      return fail(r.error);
    }
    const imageMissing = r.value.imageMissing || Boolean(a.imageUrl && !a.imageDemo && !keep && !file);
    await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId: r.value.id, remoteUrl: r.value.url, remoteMediaId: r.value.image, remoteMediaSrc: r.value.image ? a.imageUrl : null, status: "ok", error: null, lastAttemptAt: at });
    await db.updateArticle(workspaceId, a.id, { status: draft ? "draft" : "published", publishedAt: draft ? a.publishedAt : (a.publishedAt ?? at) });
    return { ok: true, value: { mode: site.publishMode, url: r.value.url, simulated: false, imageMissing, target: "github" } };
  }
  if (!integ.demo && config.cms) {
    const secret = await db.integrationSecret(workspaceId, integ.id);
    if (!secret || !integ.config.endpoint || !integ.config.username) return fail("Reconnectez WordPress (identifiants manquants).");
    const creds = { endpoint: integ.config.endpoint, username: integ.config.username, appPassword: secret };
    // Image mise en avant : envoyée une fois, renvoyée seulement si elle a changé, retirée si l'article n'en a plus.
    let media = { id: prev?.remoteMediaId ?? null, src: prev?.remoteMediaSrc ?? null };
    let featuredMedia: number | undefined;
    let imageMissing = false;
    if (!a.imageUrl || a.imageDemo) {
      if (media.id) featuredMedia = 0;
      media = { id: null, src: null };
    } else if (media.id && media.src === a.imageUrl && /^\d+$/.test(media.id)) {
      featuredMedia = Number(media.id);
    } else {
      const file = await ownImageBytes(a);
      const up = file ? await uploadWordPressMedia(creds, { ...file, filename: `${a.slug}.${file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg"}`, alt: a.imageAlt }) : null;
      if (up?.ok) { featuredMedia = up.value.id; media = { id: String(up.value.id), src: a.imageUrl }; }
      else imageMissing = true; // l'article part quand même, sans son image
    }
    const r = await upsertWordPressPost(creds, { title: a.title, html, slug: a.slug, excerpt: a.metaDescription, status: site.publishMode, featuredMedia }, prev?.remoteId ?? null);
    const at = new Date().toISOString();
    if (!r.ok) {
      await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId: prev?.remoteId ?? null, remoteUrl: prev?.remoteUrl ?? null, remoteMediaId: media.id, remoteMediaSrc: media.src, status: "error", error: r.error, lastAttemptAt: at });
      return fail(r.error);
    }
    await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId: r.value.id, remoteUrl: r.value.url, remoteMediaId: media.id, remoteMediaSrc: media.src, status: "ok", error: null, lastAttemptAt: at });
    await db.updateArticle(workspaceId, a.id, {
      status: site.publishMode === "publish" ? "published" : "draft",
      publishedAt: site.publishMode === "publish" ? (a.publishedAt ?? at) : a.publishedAt,
    });
    return { ok: true, value: { mode: site.publishMode, url: r.value.url, simulated: false, imageMissing } };
  }
  const remoteId = prev?.remoteId ?? `demo-${createHash("sha256").update(a.id).digest("hex").slice(0, 6)}`;
  const base = integ.config.endpoint ?? site.url;
  const url = integ.kind === "github"
    ? (site.publishMode === "draft" ? `https://github.com/${integ.config.repo}/blob/${integ.config.branch}/${integ.config.dir}/articles/${a.slug}.json` : articleUrl(site, integ, a.slug))
    : site.publishMode === "draft" ? `${base}/wp-admin/post.php?post=${remoteId}&action=edit` : `${base}/${a.slug}/`;
  await db.recordPublication(workspaceId, { articleId: a.id, integrationId: integ.id, remoteId, remoteUrl: url, status: "ok", error: null, lastAttemptAt: new Date().toISOString() });
  await db.updateArticle(workspaceId, a.id, {
    status: site.publishMode === "publish" ? "published" : "draft",
    publishedAt: site.publishMode === "publish" ? (a.publishedAt ?? new Date().toISOString()) : a.publishedAt,
  });
  void html;
  return { ok: true, value: { mode: site.publishMode, url, simulated: true, ...(integ.kind === "github" ? { target: "github" as const } : {}) } };
}

/** Délai minimal entre deux audits d'un même site (chaque audit lit jusqu'à 30 pages du site). */
const AUDIT_COOLDOWN_MS = 2 * 60_000;

/**
 * F06 : audit technique. Lit le site (30 pages au plus, 30 secondes, adresses publiques seulement,
 * robots.txt respecté) et mesure la vitesse sur téléphone en parallèle, puis note sur 100.
 * Un site injoignable donne un audit « échoué » avec la raison, pas une erreur.
 */
export async function runAudit(workspaceId: string, siteId: string): Promise<Result<{ score: number | null }>> {
  const site = await db.getSite(workspaceId, siteId);
  const last = await db.latestAudit(workspaceId, siteId);
  if (last?.status === "done" && Date.now() - new Date(last.createdAt).getTime() < AUDIT_COOLDOWN_MS) return fail("Un audit vient d'être fait. Attendez deux minutes avant de le relancer.");
  const [crawl, speed] = await Promise.all([crawlSite(site.url, { maxPages: 30, budgetMs: 30_000 }), pageSpeed(site.url, 35_000)]);
  if ("error" in crawl) {
    await db.saveAudit(workspaceId, siteId, { status: "failed", pagesCrawled: 0, score: null, speed: null, error: crawl.error, issues: [] });
    return fail(`Le site n'a pas pu être lu : ${crawl.error}.`);
  }
  const { score, issues } = scoreSite({ ...crawl, speed }, { name: site.name, phone: null, address: null });
  await db.saveAudit(workspaceId, siteId, {
    status: "done", pagesCrawled: crawl.pages.length, score, speed: speed ? { score: speed.score, lcp_ms: speed.lcp_ms } : null, error: null,
    issues: toAuditIssues(issues),
  });
  return { ok: true, value: { score } };
}

// ---------------------------------------------------------------------------
// Mots-clés (Google Search Console)
// ---------------------------------------------------------------------------

const google = () => ({ clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim() });
const SEARCH_COOLDOWN_MS = 60_000;

/** Sans identifiants Google : connexion d'exemple, avec des chiffres fabriqués à partir des sujets du calendrier. */
export async function connectSearchDemo(workspaceId: string, siteId: string): Promise<Result> {
  if (config.search) return fail("Connectez votre compte Google.");
  const site = await db.getSite(workspaceId, siteId);
  await db.saveSearchConnection(workspaceId, siteId, { property: `sc-domain:${new URL(site.url).hostname.replace(/^www\./, "")}`, demo: true });
  return syncSearch(workspaceId, siteId, { force: true });
}

/** Retour de Google : échange le code, trouve la propriété Search Console du site, garde le jeton chiffré, puis lit les chiffres. */
export async function finishGoogleConnect(workspaceId: string, siteId: string, code: string, redirectUri: string): Promise<Result> {
  if (!config.search) return fail("La connexion à Google n'est pas configurée.");
  const site = await db.getSite(workspaceId, siteId);
  const tokens = await exchangeCode(google(), code, redirectUri);
  if (!tokens.ok) return fail(tokens.error);
  const props = await listProperties(tokens.value.access);
  if (!props.ok) { await revokeToken(tokens.value.refresh); return fail(props.error); }
  const property = matchProperty(site.url, props.value);
  if (!property) {
    await revokeToken(tokens.value.refresh);
    return fail(`Ce compte Google n'a pas ${new URL(site.url).hostname} dans Search Console. Ajoutez et validez le site dans Search Console, ou connectez le compte Google qui le gère.`);
  }
  await db.saveSearchConnection(workspaceId, siteId, { property, demo: false }, tokens.value.refresh);
  return syncSearch(workspaceId, siteId, { force: true });
}

/** Relit les 90 derniers jours chez Google et refait le rapport. Une erreur est gardée sur la connexion, pas levée. */
export async function syncSearch(workspaceId: string, siteId: string, opts: { force?: boolean } = {}): Promise<Result> {
  const conn = await db.searchConnection(workspaceId, siteId);
  if (!conn) return fail("Search Console n'est pas connecté.");
  if (!opts.force && conn.lastSyncedAt && Date.now() - new Date(conn.lastSyncedAt).getTime() < SEARCH_COOLDOWN_MS) return fail("Les chiffres viennent d'être mis à jour. Google ne les actualise qu'une fois par jour.");
  const today = localDate(new Date(), "UTC");
  if (conn.demo) {
    const site = await db.getSite(workspaceId, siteId);
    const keywords = (await db.listCalendar(workspaceId, siteId)).map((c) => c.keyword);
    const rows = sampleRows(site.id, keywords.length ? keywords : [site.theme || site.name], today);
    await db.saveSearchReport(workspaceId, siteId, buildReport(rows.days, rows.queries, today));
    return { ok: true, value: undefined };
  }
  if (!config.search) return fail("La connexion à Google n'est pas configurée.");
  const refresh = await db.searchSecret(workspaceId, siteId);
  if (!refresh) { await db.markSearchError(workspaceId, siteId, "Reconnectez votre compte Google."); return fail("Reconnectez votre compte Google."); }
  const access = await refreshAccess(google(), refresh);
  if (!access.ok) { await db.markSearchError(workspaceId, siteId, access.error); return fail(access.error); }
  const to = addDays(today, -1);
  const [days, queries] = await Promise.all([
    dailyTotals(access.value, conn.property, addDays(to, -(CHART_DAYS + 3)), to),
    dailyQueries(access.value, conn.property, addDays(to, -(PERIOD_DAYS * 2 + 3)), to),
  ]);
  const bad = !days.ok ? days : !queries.ok ? queries : null;
  if (bad || !days.ok || !queries.ok) { await db.markSearchError(workspaceId, siteId, bad!.error); return fail(bad!.error); }
  await db.saveSearchReport(workspaceId, siteId, buildReport(days.value, queries.value, today));
  return { ok: true, value: undefined };
}

/** Déconnexion : l'accès est retiré chez Google, puis le jeton et les chiffres sont effacés chez nous. */
export async function disconnectSearch(workspaceId: string, siteId: string): Promise<void> {
  const conn = await db.searchConnection(workspaceId, siteId);
  if (!conn) return;
  if (!conn.demo && config.search) {
    const refresh = await db.searchSecret(workspaceId, siteId).catch(() => null);
    if (refresh) await revokeToken(refresh);
  }
  await db.removeSearchConnection(workspaceId, siteId);
}
