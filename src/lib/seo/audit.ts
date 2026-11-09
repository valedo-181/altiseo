/**
 * Audit SEO du site d'une société (lot A) : lecture d'une page HTML, contrôles et note sur 100.
 * Fonctions pures (sans réseau), testées dans audit.test.ts ; la lecture du site est dans crawl.ts.
 */

export type PageFacts = {
  url: string;
  status: number;
  /** Temps de réponse en millisecondes. */
  ms: number;
  title: string | null;
  description: string | null;
  h1: string[];
  noindex: boolean;
  canonical: string | null;
  lang: string | null;
  viewport: boolean;
  images: number;
  imagesNoAlt: number;
  words: number;
  /** Types schema.org trouvés dans les blocs JSON-LD (« MovingCompany », « LocalBusiness »…). */
  ldTypes: string[];
  /** Texte visible (pour chercher le téléphone et l'adresse), 20'000 caractères au plus. */
  text: string;
  /** Liens href de la page (absolus), pour continuer la lecture du site. */
  links: string[];
};

export type IssueLevel = "critique" | "moyen" | "info" | "ok";

export const ISSUE_CODES = [
  "https", "indexable", "title", "description", "h1", "img_alt", "viewport", "speed", "local_business",
  "phone", "address", "sitemap", "broken", "title_duplicate", "thin",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

export type Issue = {
  code: IssueCode;
  level: IssueLevel;
  /** Pages (ou images) concernées et total contrôlé ; 0/0 pour un contrôle du site entier. */
  count: number;
  total: number;
  /** 10 adresses au plus, pour « Voir les pages ». */
  pages: string[];
  /** Valeur utile à l'écran (note de vitesse, titre en double…). */
  detail?: string | number | null;
};

export type Speed = { score: number; lcp_ms: number | null; cls: number | null; inp_ms: number | null; fcp_ms: number | null };

/** Poids de chaque contrôle dans la note (total 100) et gravité quand il échoue. */
export const CHECKS: Record<IssueCode, { weight: number; level: Exclude<IssueLevel, "ok"> }> = {
  https: { weight: 10, level: "critique" },
  indexable: { weight: 10, level: "critique" },
  title: { weight: 10, level: "critique" },
  description: { weight: 8, level: "moyen" },
  h1: { weight: 6, level: "moyen" },
  img_alt: { weight: 5, level: "info" },
  viewport: { weight: 5, level: "critique" },
  speed: { weight: 12, level: "critique" },
  local_business: { weight: 8, level: "moyen" },
  phone: { weight: 6, level: "moyen" },
  address: { weight: 4, level: "moyen" },
  sitemap: { weight: 4, level: "info" },
  broken: { weight: 6, level: "critique" },
  title_duplicate: { weight: 3, level: "info" },
  thin: { weight: 3, level: "info" },
};

/** Types schema.org qui décrivent une entreprise locale. */
const LOCAL_TYPES = new Set([
  "LocalBusiness", "MovingCompany", "SelfStorage", "HomeAndConstructionBusiness", "ProfessionalService", "Organization",
  "HousePainter", "Locksmith", "GeneralContractor", "Store", "AutomotiveBusiness",
]);

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ecirc: "ê", ocirc: "ô", uuml: "ü", ouml: "ö", auml: "ä" };

/** « L&#39;équipe &amp; co » → « L'équipe & co ». */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Attribut d'une balise (guillemets doubles, simples ou sans guillemets). */
export function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
}

/** Balises <meta …> : contenu de celle dont l'attribut key vaut value (name="description", property="og:title"). */
function meta(html: string, key: string, value: string): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(m[0], key) ?? "").toLowerCase() === value) return attr(m[0], "content");
  }
  return null;
}

function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Types @type d'un bloc JSON-LD, y compris dans @graph et les tableaux. */
function ldTypesOf(v: unknown, out: Set<string>, depth = 0) {
  if (depth > 6 || !v) return;
  if (Array.isArray(v)) return v.forEach((x) => ldTypesOf(x, out, depth + 1));
  if (typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  const t = o["@type"];
  for (const x of Array.isArray(t) ? t : [t]) if (typeof x === "string") out.add(x.replace(/^https?:\/\/schema\.org\//, ""));
  if (o["@graph"]) ldTypesOf(o["@graph"], out, depth + 1);
}

/** Lit une page HTML : titre, description, H1, images, JSON-LD, texte et liens. */
export function analyzePage(html: string, url: string, status = 200, ms = 0): PageFacts {
  const head = html.slice(0, 200_000);
  const body = html.slice(0, 1_500_000);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const robots = (meta(head, "name", "robots") ?? "") + "," + (meta(head, "name", "googlebot") ?? "");
  let canonical: string | null = null;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    if ((attr(m[0], "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")) canonical = attr(m[0], "href");
  }
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const ld = new Set<string>();
  for (const m of body.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      ldTypesOf(JSON.parse(m[1]), ld);
    } catch {
      /* bloc illisible : ignoré */
    }
  }
  const visible = clean(body.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " "));
  const links = new Set<string>();
  for (const m of body.matchAll(/<a\b[^>]*>/gi)) {
    const h = attr(m[0], "href");
    const rel = (attr(m[0], "rel") ?? "").toLowerCase();
    if (!h || rel.includes("nofollow") || /^(mailto|tel|javascript|sms|whatsapp):/i.test(h)) continue;
    const a = absolute(h, url);
    if (a) links.add(a);
  }
  return {
    url,
    status,
    ms,
    title: title !== undefined ? clean(title) || null : null,
    description: meta(head, "name", "description")?.replace(/\s+/g, " ").trim() || null,
    h1: [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => clean(m[1])).filter(Boolean),
    noindex: /noindex/i.test(robots),
    canonical: canonical ? absolute(canonical, url) : null,
    lang: attr(/<html\b[^>]*>/i.exec(head)?.[0] ?? "", "lang"),
    viewport: !!meta(head, "name", "viewport"),
    images: imgs.length,
    imagesNoAlt: imgs.filter((t) => { const a = attr(t, "alt"); return a === null || (a === "" && !/role\s*=\s*["']?presentation/i.test(t)); }).length,
    words: visible ? visible.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0,
    ldTypes: [...ld],
    text: visible.slice(0, 20_000),
    links: [...links].slice(0, 500),
  };
}

/** Chiffres d'un numéro suisse, sans indicatif : « +41 32 724 00 00 » et « 032 724 00 00 » → « 327240000 ». */
export function phoneDigits(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0041")) d = d.slice(4);
  else if (d.startsWith("41") && d.length === 11) d = d.slice(2);
  return d.replace(/^0/, "");
}

/** Le texte contient-il ce numéro (espaces, points, indicatif +41 ou 0 acceptés) ? */
export function textHasPhone(text: string, phone: string | null | undefined): boolean {
  const want = phoneDigits(phone);
  if (want.length < 8) return false;
  for (const m of text.matchAll(/(?:\+|00)?[\d][\d\s./()-]{7,20}\d/g)) if (phoneDigits(m[0]) === want) return true;
  return false;
}

/** Code postal (4 chiffres) d'une adresse : « Rue des Saars 115, 2000 Neuchâtel » → « 2000 ». */
export const npaOf = (address: string | null | undefined): string | null => /\b([1-9]\d{3})\b(?=\s+\p{L})/u.exec(address ?? "")?.[1] ?? null;

/** Hôte sans « www. » : « https://www.swissdem.ch/fr » → « swissdem.ch ». */
export const bareHost = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};

export type SiteFacts = {
  /** Adresse finale de la page d'accueil (après redirections). */
  home: string;
  pages: PageFacts[];
  /** Pages trouvées mais en erreur (404, 500…) ou injoignables. */
  broken: { url: string; status: number }[];
  sitemap: boolean;
  speed: Speed | null;
};

export type CompanyFacts = { name: string; phone: string | null; address: string | null };

const pagesWhere = (pages: PageFacts[], bad: (p: PageFacts) => boolean) => pages.filter(bad).map((p) => p.url);

/** Contrôles du site et note sur 100 (les contrôles sans donnée, ex. vitesse non lue, ne comptent pas). */
export function scoreSite(site: SiteFacts, co: CompanyFacts): { score: number; issues: Issue[] } {
  const pages = site.pages.filter((p) => p.status < 400);
  const n = pages.length;
  const home = pages[0];
  const done: { issue: Issue; passed: number }[] = [];
  // passed = part du contrôle réussie (0 à 1), null = pas de donnée
  const add = (code: IssueCode, passed: number | null, count: number, total: number, list: string[] = [], detail?: Issue["detail"]) => {
    if (passed === null) return;
    done.push({ issue: { code, level: passed >= 0.999 ? "ok" : CHECKS[code].level, count, total, pages: list.slice(0, 10), detail: detail ?? null }, passed: Math.max(0, passed) });
  };
  const share = (list: string[]) => (n ? 1 - list.length / n : null);

  add("https", site.home.startsWith("https://") ? 1 : 0, 0, 0);
  const noindex = pagesWhere(pages, (p) => p.noindex);
  add("indexable", home?.noindex ? 0 : share(noindex), noindex.length, n, noindex);
  const badTitle = pagesWhere(pages, (p) => !p.title || p.title.length < 15 || p.title.length > 70);
  add("title", share(badTitle), badTitle.length, n, badTitle);
  const badDesc = pagesWhere(pages, (p) => !p.description || p.description.length < 50 || p.description.length > 170);
  add("description", share(badDesc), badDesc.length, n, badDesc);
  const badH1 = pagesWhere(pages, (p) => p.h1.length !== 1);
  add("h1", share(badH1), badH1.length, n, badH1);
  const imgs = pages.reduce((s, p) => s + p.images, 0);
  const noAlt = pages.reduce((s, p) => s + p.imagesNoAlt, 0);
  add("img_alt", imgs ? 1 - noAlt / imgs : 1, noAlt, imgs, pagesWhere(pages, (p) => p.imagesNoAlt > 0));
  add("viewport", home ? (home.viewport ? 1 : 0) : null, 0, 0);
  add("speed", site.speed ? Math.min(1, site.speed.score / 90) : null, 0, 0, [], site.speed?.score ?? null);
  const hasLocal = pages.some((p) => p.ldTypes.some((t) => LOCAL_TYPES.has(t)));
  add("local_business", n ? (hasLocal ? 1 : 0) : null, 0, 0);
  const allText = pages.map((p) => p.text).join(" ");
  add("phone", co.phone && n ? (textHasPhone(allText, co.phone) ? 1 : 0) : null, 0, 0, [], co.phone);
  const npa = npaOf(co.address);
  add("address", npa && n ? (new RegExp(`\\b${npa}\\b`).test(allText) ? 1 : 0) : null, 0, 0, [], co.address);
  add("sitemap", site.sitemap ? 1 : 0, 0, 0);
  const total = site.pages.length + site.broken.length;
  add("broken", total ? 1 - site.broken.length / total : null, site.broken.length, total, site.broken.map((b) => b.url));
  const seen = new Map<string, string[]>();
  for (const p of pages) if (p.title) seen.set(p.title.toLowerCase(), [...(seen.get(p.title.toLowerCase()) ?? []), p.url]);
  const dup = [...seen.values()].filter((l) => l.length > 1).flat();
  add("title_duplicate", share(dup), dup.length, n, dup);
  const thin = pagesWhere(pages, (p) => p.words < 250);
  add("thin", share(thin), thin.length, n, thin);

  const got = done.reduce((s, d) => s + CHECKS[d.issue.code].weight * d.passed, 0);
  const max = done.reduce((s, d) => s + CHECKS[d.issue.code].weight, 0);
  const issues = done.map((d) => d.issue);
  const order: Record<IssueLevel, number> = { critique: 0, moyen: 1, info: 2, ok: 3 };
  issues.sort((a, b) => order[a.level] - order[b.level] || CHECKS[b.code].weight - CHECKS[a.code].weight);
  return { score: max ? Math.round((got / max) * 100) : 0, issues };
}

/** Points perdus par un contrôle (pour classer les actions « À faire » par impact). */
export function issueImpact(i: Issue): number {
  if (i.level === "ok") return 0;
  const w = CHECKS[i.code].weight;
  if (i.total > 0) return Math.round((w * i.count) / i.total * 10) / 10 || w * 0.1;
  if (i.code === "speed" && typeof i.detail === "number") return Math.round(w * (1 - Math.min(1, i.detail / 90)) * 10) / 10;
  return w;
}

/** Résumé d'une page pour l'enregistrement (sans le texte ni les liens). */
export const pageSummary = (p: PageFacts) => ({
  url: p.url.slice(0, 300), status: p.status, ms: p.ms, title: p.title?.slice(0, 200) ?? null,
  description: p.description?.slice(0, 300) ?? null, h1: p.h1.length, words: p.words,
});
export type PageSummary = ReturnType<typeof pageSummary>;
