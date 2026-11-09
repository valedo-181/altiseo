import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { analyzePage, bareHost, type PageFacts, type SiteFacts, type Speed } from "./audit.ts";

/**
 * Lecture du site d'une société pour l'audit (lot A), côté serveur seulement.
 * Sécurité : seules les adresses publiques sont lues (pas de 127.0.0.1, 10.x, 192.168.x, métadonnées
 * du cloud…), chaque redirection est revérifiée, 1,5 Mo par page au plus, robots.txt respecté.
 */

export const USER_AGENT = "Mozilla/5.0 (compatible; AltiseoBot/1.0; +https://altiseo.ch/bot)";
const MAX_BYTES = 1_500_000;

/** Adresse IP privée, locale ou réservée (IPv4 et IPv6). */
export function privateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return privateIp(mapped[1]);
    return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff") || x.startsWith("64:ff9b:") || x.startsWith("2001:db8");
  }
  return true;
}

/** L'adresse peut-elle être lue (http/https, port standard, nom public) ? */
export async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost|lan)$/i.test(host)) return null;
  if (isIP(host)) return privateIp(host) ? null : u;
  try {
    const addrs = await lookup(host, { all: true, verbatim: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

export type Fetched = { url: string; status: number; type: string; body: string; ms: number };

/** GET avec redirections vérifiées une à une (5 au plus) ; body vide si ce n'est pas du texte. */
export async function safeFetch(raw: string, timeoutMs = 8000): Promise<Fetched | { url: string; status: 0; error: string }> {
  let url = raw;
  const t0 = Date.now();
  for (let hop = 0; hop < 6; hop++) {
    const u = await publicUrl(url);
    if (!u) return { url, status: 0, error: "Adresse non publique ou invalide" };
    let res: Response;
    try {
      res = await fetch(u, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      return { url, status: 0, error: e instanceof Error && e.name === "TimeoutError" ? "Délai dépassé" : "Site injoignable" };
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, u).toString();
      await res.body?.cancel().catch(() => {});
      continue;
    }
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    let body = "";
    if (/text|html|xml/.test(type) && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          chunks.push(value);
          if (size >= MAX_BYTES) {
            await reader.cancel().catch(() => {});
            break;
          }
        }
      } catch {
        /* lecture coupée : on garde ce qui est arrivé */
      }
      body = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
    } else {
      await res.body?.cancel().catch(() => {});
    }
    return { url: u.toString(), status: res.status, type, body, ms: Date.now() - t0 };
  }
  return { url, status: 0, error: "Trop de redirections" };
}

/** Règles « Disallow » de robots.txt pour tous les robots (User-agent: *) et adresses Sitemap. */
export function parseRobots(txt: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  let forAll = false;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      forAll = lastWasAgent ? forAll || val === "*" : val === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === "sitemap" && val) sitemaps.push(val);
    else if (key === "disallow" && forAll && val) disallow.push(val);
  }
  return { disallow, sitemaps };
}

const allowed = (url: string, disallow: string[]) => {
  try {
    const path = new URL(url).pathname;
    return !disallow.some((d) => path.startsWith(d.replace(/\*.*$/, "")));
  } catch {
    return false;
  }
};

/** Adresses <loc> d'un sitemap (200 au plus). */
export const sitemapLocs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&")).slice(0, 200);

/** Page à lire ? Même site (avec ou sans www), pas un fichier (PDF, image…). */
function crawlable(url: string, host: string): boolean {
  try {
    const u = new URL(url);
    return bareHost(url) === host && !/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3|avi|ico|css|js|xml|json|txt)$/i.test(u.pathname);
  } catch {
    return false;
  }
}

const key = (url: string) => {
  const u = new URL(url);
  u.hash = "";
  return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;
};

/**
 * Lit le site : robots.txt, sitemap, puis les pages (largeur d'abord) jusqu'à maxPages ou la fin du temps.
 * La vitesse (PageSpeed) se lit en parallèle, voir pageSpeed().
 */
export async function crawlSite(start: string, opts: { maxPages?: number; budgetMs?: number } = {}): Promise<Omit<SiteFacts, "speed"> | { error: string }> {
  const maxPages = opts.maxPages ?? 50;
  const deadline = Date.now() + (opts.budgetMs ?? 35_000);
  const first = await safeFetch(start, 10_000);
  if ("error" in first) return { error: first.error };
  if (first.status >= 400) return { error: `Le site répond « erreur ${first.status} »` };
  if (!/html/.test(first.type)) return { error: "La page d'accueil n'est pas une page web" };
  const home = first.url;
  const host = bareHost(home);
  const origin = new URL(home).origin;

  const [robotsRes, sitemapGuess] = await Promise.all([safeFetch(`${origin}/robots.txt`, 5000), Promise.resolve(`${origin}/sitemap.xml`)]);
  const robots = robotsRes.status === 200 && "body" in robotsRes && !/html/.test(robotsRes.type) ? parseRobots(robotsRes.body) : { disallow: [], sitemaps: [] };
  let sitemap = false;
  const seeds: string[] = [];
  for (const sm of [...robots.sitemaps.slice(0, 2), sitemapGuess]) {
    if (sitemap || Date.now() > deadline) break;
    const r = await safeFetch(sm, 6000);
    if (r.status !== 200 || !("body" in r) || !/<(urlset|sitemapindex)\b/i.test(r.body)) continue;
    sitemap = true;
    let locs = sitemapLocs(r.body);
    if (/<sitemapindex\b/i.test(r.body) && locs[0]) {
      const child = await safeFetch(locs[0], 6000);
      locs = child.status === 200 && "body" in child ? sitemapLocs(child.body) : [];
    }
    seeds.push(...locs);
  }

  const pages: PageFacts[] = [analyzePage(first.body, home, first.status, first.ms)];
  const broken: { url: string; status: number }[] = [];
  const seen = new Set([key(home), key(start)]);
  const queue: string[] = [];
  const push = (u: string) => {
    if (!crawlable(u, host) || !allowed(u, robots.disallow)) return;
    const k = key(u);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push(u);
  };
  pages[0].links.forEach(push);
  seeds.forEach(push);

  let reading = 0;
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      while (Date.now() < deadline && pages.length + broken.length + reading < maxPages) {
        const url = queue.shift();
        if (!url) {
          if (!reading) return;
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        reading++;
        const r = await safeFetch(url, 8000);
        reading--;
        if (r.status === 0 || r.status >= 400) {
          broken.push({ url, status: r.status });
          continue;
        }
        if (!("body" in r) || !/html/.test(r.type)) continue;
        if (bareHost(r.url) !== host) continue;
        const k = key(r.url);
        if (k !== key(url) && pages.some((p) => key(p.url) === k)) continue;
        const p = analyzePage(r.body, r.url, r.status, r.ms);
        pages.push(p);
        p.links.forEach(push);
      }
    }),
  );
  return { home, pages: pages.slice(0, maxPages), broken: broken.slice(0, 50), sitemap };
}

/** Vitesse sur téléphone (PageSpeed Insights, gratuit) ; null si Google ne répond pas à temps. */
export async function pageSpeed(url: string, timeoutMs = 45_000): Promise<Speed | null> {
  const key = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
  const call = async (withKey: boolean) => {
    const q = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
    if (withKey && key) q.set("key", key);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok, status: res.status, json: (await res.json().catch(() => null)) as PsiJson | null };
  };
  try {
    let r = await call(true);
    // Clé limitée à d'autres API Google : on réessaie sans clé
    if (!r.ok && key && (r.status === 400 || r.status === 403)) r = await call(false);
    return r.ok && r.json ? parsePsi(r.json) : null;
  } catch {
    return null;
  }
}

type PsiJson = { lighthouseResult?: { categories?: { performance?: { score?: number | null } }; audits?: Record<string, { numericValue?: number }> }; loadingExperience?: { metrics?: Record<string, { percentile?: number }> } };

export function parsePsi(j: PsiJson): Speed | null {
  const s = j.lighthouseResult?.categories?.performance?.score;
  if (typeof s !== "number") return null;
  const a = j.lighthouseResult?.audits ?? {};
  const num = (k: string) => (typeof a[k]?.numericValue === "number" ? Math.round(a[k].numericValue!) : null);
  const inp = j.loadingExperience?.metrics?.INTERACTION_TO_NEXT_PAINT?.percentile;
  const cls = a["cumulative-layout-shift"]?.numericValue;
  return {
    score: Math.round(s * 100),
    lcp_ms: num("largest-contentful-paint"),
    fcp_ms: num("first-contentful-paint"),
    cls: typeof cls === "number" ? Math.round(cls * 1000) / 1000 : null,
    inp_ms: typeof inp === "number" ? inp : null,
  };
}
