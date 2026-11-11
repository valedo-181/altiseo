/**
 * WordPress par son API REST officielle (wp/v2) et un mot de passe d'application (WordPress 5.6+) :
 * rien à installer sur le site. Création d'un billet, puis mise à jour du même (id gardé).
 * Sécurité : l'adresse doit être publique (pas d'adresse interne), pas de redirection suivie,
 * délai maximal, le mot de passe ne sort jamais dans les messages d'erreur.
 */
import { publicUrl } from "../seo/crawl.ts";

export type WpCreds = { endpoint: string; username: string; appPassword: string };
/** featuredMedia : id d'une image de la médiathèque ; 0 la retire ; absent = on n'y touche pas. */
export type WpPost = { title: string; html: string; slug: string; excerpt: string; status: "draft" | "publish"; featuredMedia?: number };
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export type WpResult<T> = { ok: true; value: T } | { ok: false; error: string };

const TIMEOUT = 20_000;

async function call(creds: WpCreds, route: string, init: RequestInit, f: Fetcher): Promise<Response | string> {
  const base = await publicUrl(creds.endpoint);
  if (!base) return "Cette adresse n'est pas un site public joignable.";
  const auth = `Basic ${Buffer.from(`${creds.username}:${creds.appPassword.replace(/\s+/g, "")}`).toString("base64")}`;
  const headers = { Authorization: auth, Accept: "application/json", "Content-Type": "application/json", "User-Agent": "AltiseoBot/1.0 (+https://altiseo.ch/bot)" };
  const root = base.origin;
  // Jolis permaliens (/wp-json/…) d'abord, puis la forme qui marche partout (?rest_route=…).
  for (const url of [`${root}/wp-json${route}`, `${root}/?rest_route=${encodeURIComponent(route.split("?")[0])}${route.includes("?") ? `&${route.split("?")[1]}` : ""}`]) {
    let r: Response;
    try {
      r = await f(url, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, redirect: "manual", signal: AbortSignal.timeout(init.body instanceof Uint8Array ? 60_000 : TIMEOUT) });
    } catch {
      return "Le site ne répond pas (délai dépassé ou adresse injoignable).";
    }
    if (r.status === 404) {
      // 404 de WordPress sur un billet (ex. rest_post_invalid_id) ≠ API introuvable (rest_no_route ou page HTML).
      const code = (await json(r.clone()))?.code;
      if (code && code !== "rest_no_route") return r;
      continue;
    }
    return r;
  }
  return "L'API de WordPress est introuvable sur ce site (wp-json). Est-ce bien un site WordPress ?";
}

function explain(status: number, body: { code?: string; message?: string } | null): string {
  if (status === 401 || body?.code === "rest_not_logged_in" || body?.code === "invalid_username" || body?.code === "incorrect_password") {
    return "WordPress refuse l'identifiant ou le mot de passe d'application. Vérifiez le nom d'utilisateur et créez un nouveau mot de passe d'application.";
  }
  if (status === 403) return "Ce compte WordPress n'a pas le droit de publier des articles (rôle Auteur ou Éditeur requis).";
  if (status >= 300 && status < 400) return "Le site redirige l'API vers une autre adresse : indiquez l'adresse finale du site (avec ou sans www).";
  if (status >= 500) return `Le site WordPress a renvoyé une erreur (${status}). Réessayez plus tard.`;
  return `WordPress a refusé la demande (${status}${body?.code ? ` ${body.code}` : ""}).`;
}

async function json(r: Response): Promise<any> {
  try { return await r.json(); } catch { return null; }
}

/** Test de connexion : l'utilisateur existe et peut écrire des articles. */
export async function testWordPress(creds: WpCreds, f: Fetcher = fetch): Promise<WpResult<{ name: string }>> {
  const r = await call(creds, "/wp/v2/users/me?context=edit", { method: "GET" }, f);
  if (typeof r === "string") return { ok: false, error: r };
  const body = await json(r);
  if (!r.ok) return { ok: false, error: explain(r.status, body) };
  const caps = body?.capabilities ?? {};
  if (caps && Object.keys(caps).length && !caps.edit_posts) return { ok: false, error: "Ce compte WordPress n'a pas le droit d'écrire des articles." };
  return { ok: true, value: { name: String(body?.name ?? creds.username) } };
}

/** Crée le billet, ou met à jour celui déjà créé (remoteId). Renvoie l'id et l'adresse. */
export async function upsertWordPressPost(creds: WpCreds, post: WpPost, remoteId: string | null, f: Fetcher = fetch): Promise<WpResult<{ id: string; url: string }>> {
  const route = remoteId && /^\d+$/.test(remoteId) ? `/wp/v2/posts/${remoteId}` : "/wp/v2/posts";
  const r = await call(creds, route, { method: "POST", body: JSON.stringify({ title: post.title, content: post.html, slug: post.slug, excerpt: post.excerpt, status: post.status, ...(post.featuredMedia === undefined ? {} : { featured_media: post.featuredMedia }) }) }, f);
  if (typeof r === "string") return { ok: false, error: r };
  const body = await json(r);
  if (r.status === 404 && remoteId) return upsertWordPressPost(creds, post, null, f); // billet supprimé côté WordPress : on le recrée
  if (!r.ok || !body?.id) return { ok: false, error: explain(r.status, body) };
  const url = post.status === "draft" ? `${new URL(creds.endpoint).origin}/wp-admin/post.php?post=${body.id}&action=edit` : String(body.link ?? creds.endpoint);
  return { ok: true, value: { id: String(body.id), url } };
}

export type WpMedia = { bytes: Uint8Array; contentType: "image/jpeg" | "image/png" | "image/webp"; filename: string; alt: string };

/** Dépose une image dans la médiathèque (elle servira d'image mise en avant), puis lui donne son texte de remplacement. */
export async function uploadWordPressMedia(creds: WpCreds, media: WpMedia, f: Fetcher = fetch): Promise<WpResult<{ id: number }>> {
  const name = media.filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image.jpg";
  const r = await call(creds, "/wp/v2/media", { method: "POST", body: media.bytes as unknown as BodyInit, headers: { "Content-Type": media.contentType, "Content-Disposition": `attachment; filename="${name}"` } }, f);
  if (typeof r === "string") return { ok: false, error: r };
  const body = await json(r);
  const id = Number(body?.id);
  if (!r.ok || !Number.isInteger(id) || id <= 0) return { ok: false, error: r.status === 403 ? "Ce compte WordPress n'a pas le droit d'ajouter des images (rôle Auteur ou Éditeur requis)." : explain(r.status, body) };
  if (media.alt) await call(creds, `/wp/v2/media/${id}`, { method: "POST", body: JSON.stringify({ alt_text: media.alt }) }, f); // sans gravité si cela échoue
  return { ok: true, value: { id } };
}
