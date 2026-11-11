/**
 * Site statique hébergé sur GitHub (Vercel, Netlify, Cloudflare Pages…) : Altiseo écrit chaque article
 * comme un fichier JSON dans le dépôt du site, par l'API officielle de GitHub (contents). Le site le
 * transforme lui-même en page à sa prochaine mise en ligne (ex. outils/blog.mjs de domevia.ch).
 *
 * Fichiers écrits, pour un dossier « blog » :
 *   blog/articles/<slug>.json   l'article (titre, résumé, date, image, HTML…)
 *   blog/img/<slug>.<ext>       l'image d'illustration, si l'article en a une
 * Adresse publique de l'article : <site>/blog/<slug>.html
 *
 * Sécurité : un seul hôte (api.github.com), jeton à accès limité (fine-grained, « Contents » en lecture
 * et écriture sur ce seul dépôt), jamais écrit dans les messages d'erreur ; chemins construits à partir
 * d'un slug et d'un dossier vérifiés.
 */

export type GhCreds = { repo: string; branch: string; dir: string; token: string };
export type GhArticle = {
  slug: string;
  title: string;
  metaTitle: string;
  description: string;
  date: string; // ISO
  updated: string | null;
  keyword: string | null;
  html: string;
  draft: boolean;
  image: { bytes: Uint8Array; ext: "jpg" | "png" | "webp"; alt: string } | null;
  /** Image déjà dans le dépôt (chemin) et à garder telle quelle : on ne la renvoie pas. */
  keepImage: string | null;
};
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type GhResult<T> = { ok: true; value: T } | { ok: false; error: string };

const API = "https://api.github.com";
const TIMEOUT = 20_000;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const isRepo = (r: string) => /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(r) && !r.endsWith(".git") && !r.includes("..");
export const isBranch = (b: string) => /^[A-Za-z0-9._\/-]{1,100}$/.test(b) && !b.includes("..") && !b.startsWith("/") && !b.endsWith("/");
export const isDir = (d: string) => /^[a-z0-9]+(?:[-_][a-z0-9]+)*(?:\/[a-z0-9]+(?:[-_][a-z0-9]+)*){0,2}$/.test(d);
/** Jeton GitHub : fine-grained (github_pat_…) ou classique (ghp_…). */
export const looksLikeGitHubToken = (t: string) => /^(github_pat_[A-Za-z0-9_]{40,255}|ghp_[A-Za-z0-9]{36,255})$/.test(t.trim());

export const articlePath = (dir: string, slug: string) => `${dir}/articles/${slug}.json`;
export const imagePath = (dir: string, slug: string, ext: string) => `${dir}/img/${slug}.${ext}`;
/** Adresse publique d'un article sur le site (page produite par le site à partir du JSON). */
export const publicArticleUrl = (siteUrl: string, dir: string, slug: string) => `${siteUrl.replace(/\/+$/, "")}/${dir}/${slug}.html`;

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");

async function call(c: GhCreds, path: string, init: RequestInit, f: Fetcher): Promise<Response | string> {
  try {
    return await f(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${c.token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AltiseoBot/1.0",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    return "GitHub ne répond pas (délai dépassé). Réessayez dans un instant.";
  }
}

async function json(r: Response): Promise<any> {
  try { return await r.json(); } catch { return null; }
}

function explain(status: number, body: { message?: string } | null): string {
  if (status === 401) return "GitHub refuse le jeton : il est faux ou expiré. Créez-en un nouveau (Settings → Developer settings → Fine-grained tokens).";
  if (status === 403) {
    if (/rate limit/i.test(body?.message ?? "")) return "GitHub limite le nombre de demandes : réessayez dans une heure.";
    return "Le jeton n'a pas le droit d'écrire dans ce dépôt (permission « Contents : Read and write » requise).";
  }
  if (status === 404) return "Dépôt ou branche introuvable avec ce jeton. Vérifiez le nom (propriétaire/dépôt) et que le jeton a accès à ce dépôt.";
  if (status === 409) return "Le dépôt a changé pendant l'envoi : réessayez.";
  if (status === 422) return "GitHub a refusé le fichier (branche protégée ou contenu invalide).";
  if (status >= 500) return `GitHub a renvoyé une erreur (${status}). Réessayez plus tard.`;
  return `GitHub a refusé la demande (${status}).`;
}

/** Test : le dépôt existe, le jeton peut y écrire, la branche existe. */
export async function testGitHub(c: GhCreds, f: Fetcher = fetch): Promise<GhResult<{ repo: string; branch: string }>> {
  if (!isRepo(c.repo)) return { ok: false, error: "Indiquez le dépôt sous la forme propriétaire/dépôt (ex. valedo-181/domevia)." };
  if (!isBranch(c.branch)) return { ok: false, error: "Nom de branche invalide." };
  if (!isDir(c.dir)) return { ok: false, error: "Dossier invalide (lettres minuscules, chiffres et tirets, ex. blog)." };
  const r = await call(c, `/repos/${c.repo}`, { method: "GET" }, f);
  if (typeof r === "string") return { ok: false, error: r };
  const body = await json(r);
  if (!r.ok) return { ok: false, error: explain(r.status, body) };
  if (body?.permissions && body.permissions.push === false) return { ok: false, error: explain(403, null) };
  const b = await call(c, `/repos/${c.repo}/branches/${enc(c.branch)}`, { method: "GET" }, f);
  if (typeof b === "string") return { ok: false, error: b };
  if (b.status === 404) return { ok: false, error: `La branche « ${c.branch} » n'existe pas dans ${c.repo}.` };
  if (!b.ok) return { ok: false, error: explain(b.status, await json(b)) };
  return { ok: true, value: { repo: String(body?.full_name ?? c.repo), branch: c.branch } };
}

/** sha du fichier s'il existe (nécessaire pour le remplacer ou le supprimer), null sinon. */
async function shaOf(c: GhCreds, path: string, f: Fetcher): Promise<GhResult<string | null>> {
  const r = await call(c, `/repos/${c.repo}/contents/${enc(path)}?ref=${encodeURIComponent(c.branch)}`, { method: "GET" }, f);
  if (typeof r === "string") return { ok: false, error: r };
  if (r.status === 404) return { ok: true, value: null };
  const body = await json(r);
  if (!r.ok) return { ok: false, error: explain(r.status, body) };
  return { ok: true, value: typeof body?.sha === "string" ? body.sha : null };
}

async function putFile(c: GhCreds, path: string, bytes: Uint8Array, message: string, f: Fetcher): Promise<GhResult<void>> {
  const sha = await shaOf(c, path, f);
  if (!sha.ok) return sha;
  const content = Buffer.from(bytes).toString("base64");
  const r = await call(c, `/repos/${c.repo}/contents/${enc(path)}`, { method: "PUT", body: JSON.stringify({ message, content, branch: c.branch, ...(sha.value ? { sha: sha.value } : {}) }) }, f);
  if (typeof r === "string") return { ok: false, error: r };
  if (!r.ok) return { ok: false, error: explain(r.status, await json(r)) };
  return { ok: true, value: undefined };
}

async function deleteFile(c: GhCreds, path: string, message: string, f: Fetcher): Promise<GhResult<void>> {
  const sha = await shaOf(c, path, f);
  if (!sha.ok) return sha;
  if (!sha.value) return { ok: true, value: undefined };
  const r = await call(c, `/repos/${c.repo}/contents/${enc(path)}`, { method: "DELETE", body: JSON.stringify({ message, sha: sha.value, branch: c.branch }) }, f);
  if (typeof r === "string") return { ok: false, error: r };
  if (!r.ok && r.status !== 404) return { ok: false, error: explain(r.status, await json(r)) };
  return { ok: true, value: undefined };
}

/** Contenu du fichier JSON lu par le site (voir outils/blog.mjs de domevia.ch). */
export function articleJson(a: GhArticle, image: string | null): string {
  const doc: Record<string, unknown> = {
    slug: a.slug,
    title: a.title,
    ...(a.metaTitle && a.metaTitle !== a.title ? { metaTitle: a.metaTitle } : {}),
    description: a.description,
    date: a.date,
    ...(a.updated ? { updated: a.updated } : {}),
    ...(image ? { image, imageAlt: a.image?.alt ?? "" } : {}),
    ...(a.keyword ? { keyword: a.keyword } : {}),
    ...(a.draft ? { draft: true } : {}),
    html: a.html,
    source: "altiseo",
  };
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Écrit l'article (et son image) dans le dépôt. remoteId = chemin du JSON déjà écrit : si le slug a
 * changé, l'ancien fichier est retiré. Renvoie le chemin (remoteId), l'adresse et le chemin de l'image.
 */
export async function upsertGitHubArticle(
  c: GhCreds, siteUrl: string, a: GhArticle, remoteId: string | null, remoteImage: string | null, f: Fetcher = fetch,
): Promise<GhResult<{ id: string; url: string; image: string | null; imageMissing: boolean }>> {
  if (!SLUG.test(a.slug) || a.slug.length > 90) return { ok: false, error: "Slug invalide." };
  if (!isRepo(c.repo) || !isBranch(c.branch) || !isDir(c.dir)) return { ok: false, error: "Reconnectez le dépôt GitHub (réglages invalides)." };
  const path = articlePath(c.dir, a.slug);
  const verb = remoteId ? "Mettre à jour" : "Publier";

  // Image : envoyée si nouvelle, gardée si identique, retirée si l'article n'en a plus.
  let image: string | null = null;
  let imageMissing = false;
  if (a.image) {
    const p = imagePath(c.dir, a.slug, a.image.ext);
    const up = await putFile(c, p, a.image.bytes, `Altiseo : image de « ${a.title.slice(0, 80)} »`, f);
    if (up.ok) image = p; else imageMissing = true;
  } else if (a.keepImage) {
    image = a.keepImage;
  }
  if (remoteImage && remoteImage !== image && remoteImage.startsWith(`${c.dir}/img/`)) {
    await deleteFile(c, remoteImage, "Altiseo : retirer l'ancienne image", f); // sans gravité si cela échoue
  }

  const rel = image ? image.slice(c.dir.length + 1) : null; // « img/slug.jpg », relatif au dossier du blog
  const put = await putFile(c, path, new TextEncoder().encode(articleJson(a, rel)), `Altiseo : ${verb.toLowerCase()} « ${a.title.slice(0, 80)} »`, f);
  if (!put.ok) return put;
  if (remoteId && remoteId !== path && remoteId.startsWith(`${c.dir}/articles/`) && remoteId.endsWith(".json")) {
    await deleteFile(c, remoteId, "Altiseo : retirer l'ancienne adresse de l'article", f);
  }
  const url = a.draft ? `https://github.com/${c.repo}/blob/${enc(c.branch)}/${enc(path)}` : publicArticleUrl(siteUrl, c.dir, a.slug);
  return { ok: true, value: { id: path, url, image, imageMissing } };
}
