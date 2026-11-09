/**
 * WordPress par son API REST officielle (wp/v2) et un mot de passe d'application (WordPress 5.6+) :
 * rien à installer sur le site. Création d'un billet, puis mise à jour du même (id gardé).
 * Sécurité : l'adresse doit être publique (pas d'adresse interne), pas de redirection suivie,
 * délai maximal, le mot de passe ne sort jamais dans les messages d'erreur.
 */
import { publicUrl } from "../seo/crawl.ts";

export type WpCreds = { endpoint: string; username: string; appPassword: string };
export type WpPost = { title: string; html: string; slug: string; excerpt: string; status: "draft" | "publish" };
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
      r = await f(url, { ...init, headers, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) });
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
  const r = await call(creds, route, { method: "POST", body: JSON.stringify({ title: post.title, content: post.html, slug: post.slug, excerpt: post.excerpt, status: post.status }) }, f);
  if (typeof r === "string") return { ok: false, error: r };
  const body = await json(r);
  if (r.status === 404 && remoteId) return upsertWordPressPost(creds, post, null, f); // billet supprimé côté WordPress : on le recrée
  if (!r.ok || !body?.id) return { ok: false, error: explain(r.status, body) };
  const url = post.status === "draft" ? `${new URL(creds.endpoint).origin}/wp-admin/post.php?post=${body.id}&action=edit` : String(body.link ?? creds.endpoint);
  return { ok: true, value: { id: String(body.id), url } };
}
