import { createHmac } from "node:crypto";

/**
 * Statistiques sans cookies (lot E) : lecture d'une page vue envoyée par le script /s.js.
 * Aucune donnée personnelle n'est gardée : l'adresse IP et le navigateur servent seulement à calculer
 * une empreinte du jour (HMAC, secret serveur + date), effacée après deux jours. Sans réseau ni base :
 * testé dans stats.test.ts.
 */

export type Hit = { key: string; path: string; source: string; device: string; country: string };

const KEY = /^[0-9a-f]{32}$/;
const MAX_BODY = 4000;

/** Robots, aperçus de liens et outils : pas comptés. */
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python|node-fetch|axios|go-http|java\/|monitor|uptime|pingdom/i;
export const isBot = (ua: string | null | undefined) => !ua || ua.length < 20 || BOTS.test(ua);

/** Chemin de la page, sans paramètres ni ancre (ils contiennent parfois des données personnelles). */
export function cleanPath(u: URL): string {
  let p = decodeURIComponentSafe(u.pathname).replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/$/, "");
  p = p.replace(/\/index\.html?$/i, "") || "/";
  return p.slice(0, 300);
}
function decodeURIComponentSafe(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Noms connus des provenances (le reste : le domaine sans www). */
const SOURCES: Array<[RegExp, string]> = [
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)(search\.)?yahoo\.[a-z.]+$/, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)qwant\.com$/, "Qwant"],
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)gemini\.google\.com$/, "Gemini"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)copilot\.microsoft\.com$/, "Copilot"],
  [/(^|\.)(facebook\.com|fb\.com|m\.facebook\.com|l\.facebook\.com)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)local\.ch$/, "local.ch"],
  [/(^|\.)search\.ch$/, "search.ch"],
];
const UTM_NAMES: Record<string, string> = { google: "Google", bing: "Bing", facebook: "Facebook", fb: "Facebook", instagram: "Instagram", ig: "Instagram", linkedin: "LinkedIn", chatgpt: "ChatGPT", "chatgpt.com": "ChatGPT", perplexity: "Perplexity", newsletter: "Newsletter", email: "E-mail", tiktok: "TikTok", youtube: "YouTube" };

export function nameOfHost(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "");
  // gemini.google.com avant google.*
  if (/(^|\.)gemini\.google\.com$/.test(h)) return "Gemini";
  for (const [re, name] of SOURCES) if (re.test(h)) return name;
  return h.slice(0, 120);
}

/** D'où vient le visiteur : utm_source d'abord, puis le site précédent (pas le site lui-même). */
export function sourceOf(page: URL, referrer: string): string {
  const utm = (page.searchParams.get("utm_source") ?? page.searchParams.get("ref") ?? "").trim().toLowerCase();
  if (utm) return UTM_NAMES[utm] ?? (utm.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 60) || "Direct");
  if (page.searchParams.has("gclid")) return "Google Ads";
  if (!referrer) return "Direct";
  let r: URL;
  try { r = new URL(referrer); } catch { return "Direct"; }
  if (!/^https?:$/.test(r.protocol)) return "Direct";
  const same = (a: string, b: string) => a.toLowerCase().replace(/^www\./, "") === b.toLowerCase().replace(/^www\./, "");
  if (same(r.hostname, page.hostname)) return "Direct";
  return nameOfHost(r.hostname);
}

/** Appareil d'après la largeur de la fenêtre (pas d'empreinte du navigateur). */
export function deviceOf(width: unknown): string {
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) return "Ordinateur";
  return w < 768 ? "Téléphone" : w < 1100 ? "Tablette" : "Ordinateur";
}

export const cleanCountry = (c: string | null | undefined) => (c && /^[A-Z]{2}$/.test(c) ? c : "??");

/** Empreinte du jour : la même personne le même jour sur le même site, rien de plus. */
export function visitorHash(secret: string, day: string, key: string, ip: string, ua: string): string {
  return createHmac("sha256", secret).update(`${day}|${key}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** Lecture du corps envoyé par le script : { k, u, r, w }. null si ce n'est pas une page vue valable. */
export function parseHit(body: string, country: string | null): Hit | null {
  if (!body || body.length > MAX_BODY) return null;
  let j: { k?: unknown; u?: unknown; r?: unknown; w?: unknown };
  try { j = JSON.parse(body); } catch { return null; }
  if (typeof j.k !== "string" || !KEY.test(j.k) || typeof j.u !== "string") return null;
  let page: URL;
  try { page = new URL(j.u); } catch { return null; }
  if (!/^https?:$/.test(page.protocol) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(page.hostname)) return null;
  return { key: j.k, path: cleanPath(page), source: sourceOf(page, typeof j.r === "string" ? j.r.slice(0, 2000) : ""), device: deviceOf(j.w), country: cleanCountry(country) };
}

/** Le bout de code à coller sur le site. */
export function snippet(origin: string, key: string): string {
  return `<script defer src="${origin.replace(/\/$/, "")}/s.js" data-site="${key}"></script>`;
}
