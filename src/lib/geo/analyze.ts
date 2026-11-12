/**
 * Visibilité IA : lecture des réponses des IA, note, conseils, questions proposées, préparation du site.
 * Fonctions pures (sans réseau), testées dans geo.test.ts ; les appels aux IA sont dans engines.ts.
 */
import type { Lang } from "../domain/types.ts";

export const AI_ENGINES = ["chatgpt", "gemini", "perplexity", "claude"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];
export const ENGINE_LABEL: Record<AiEngine, string> = { chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity", claude: "Claude" };

/** Ce que comprend chaque offre (identique à la table plans, pour le mode démo). */
export const AI_PLANS: Record<"grow" | "scale", { maxQuestions: number; engines: AiEngine[] }> = {
  grow: { maxQuestions: 10, engines: ["chatgpt", "perplexity"] },
  scale: { maxQuestions: 30, engines: ["chatgpt", "gemini", "perplexity", "claude"] },
};

export type AiAnswer = { text: string; sources: string[] };
export type Entity = { name: string; domain: string };
export type AiResult = {
  cited: boolean; // le nom ou le domaine du site apparaît dans la réponse
  position: number | null; // place parmi les entreprises nommées (1 = la première)
  linked: boolean; // le site est dans les sources
  competitors: Entity[]; // concurrents nommés, dans l'ordre de la réponse
  sources: string[];
  excerpt: string;
};

export const MAX_SOURCES = 20;
const EXCERPT = 1400;

/** Domaine sans « www. », en minuscules ; null si l'adresse n'est pas lisible. */
export function hostOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Un domaine appartient au site (même domaine ou sous-domaine). */
export const sameSite = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Premier endroit où l'entité est nommée (nom ou domaine), ou -1. Un nom de moins de 3 lettres ne compte pas. */
function firstMention(text: string, e: Entity): number {
  const t = norm(text);
  let best = -1;
  const hit = (i: number) => { if (i >= 0 && (best < 0 || i < best)) best = i; };
  if (e.domain) {
    const label = e.domain.split(".")[0];
    hit(t.indexOf(e.domain));
    if (label.length >= 4) hit(t.search(new RegExp(`(^|[^a-z0-9])${escape(label)}([^a-z0-9]|$)`)));
  }
  const name = norm(e.name).trim();
  if (name.length >= 3) hit(t.search(new RegExp(`(^|[^a-z0-9])${escape(name)}([^a-z0-9]|$)`)));
  return best;
}

/**
 * Lit une réponse : le site est-il nommé, à quelle place parmi les entreprises connues (le site et
 * ses concurrents), est-il dans les sources, et quels concurrents sont nommés.
 */
export function analyzeAnswer(answer: AiAnswer, site: Entity, competitors: Entity[]): AiResult {
  const domain = site.domain.toLowerCase().replace(/^www\./, "");
  const sources = [...new Set(answer.sources.map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s)))].slice(0, MAX_SOURCES);
  const linked = sources.some((s) => { const h = hostOf(s); return h != null && sameSite(h, domain); });
  const own = firstMention(answer.text, { name: site.name, domain });
  const others = competitors
    .map((c) => ({ name: c.name, domain: c.domain.toLowerCase().replace(/^www\./, "") }))
    .filter((c) => c.domain && c.domain !== domain)
    .map((c) => ({ c, at: firstMention(answer.text, c) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at);
  const cited = own >= 0;
  const position = cited ? 1 + others.filter((x) => x.at < own).length : null;
  return { cited, position, linked, competitors: others.map((x) => x.c), sources, excerpt: answer.text.trim().slice(0, EXCERPT) };
}

/** Lundi (AAAA-MM-JJ) de la semaine d'un jour donné. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (wd - 1));
  return d.toISOString().slice(0, 10);
}

export type CheckLite = { questionId: string; engine: AiEngine; status: "ok" | "error"; cited: boolean; linked: boolean; position: number | null; competitors: Entity[] };

/** Note de la semaine : part des réponses (sans erreur) où le site est nommé ou dans les sources. */
export function visibilityScore(checks: CheckLite[]): { score: number | null; seen: number; total: number } {
  const ok = checks.filter((c) => c.status === "ok");
  const seen = ok.filter((c) => c.cited || c.linked).length;
  return { score: ok.length ? Math.round((seen / ok.length) * 100) : null, seen, total: ok.length };
}

/** Concurrents les plus nommés, du plus au moins cité. */
export function topCompetitors(checks: CheckLite[], limit = 5): Array<Entity & { count: number }> {
  const by = new Map<string, Entity & { count: number }>();
  for (const c of checks) {
    if (c.status !== "ok") continue;
    for (const e of new Map(c.competitors.map((x) => [x.domain, x])).values()) {
      const cur = by.get(e.domain);
      if (cur) cur.count++;
      else by.set(e.domain, { ...e, count: 1 });
    }
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Préparation du site pour les IA
// ---------------------------------------------------------------------------

/** Robots des IA vérifiés dans robots.txt (recherche et réponses, pas l'entraînement). */
export const AI_BOTS = ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended"] as const;

export type Readiness = {
  blockedBots: string[]; // robots des IA interdits sur tout le site
  llmsTxt: boolean; // /llms.txt présent
  faq: boolean; // une FAQ structurée (FAQPage) sur la page d'accueil
  organization: boolean; // Organization / LocalBusiness en JSON-LD
};

/** Robots des IA interdits sur la racine (« Disallow: / ») dans un robots.txt. */
export function blockedAiBots(robots: string): string[] {
  const groups: Array<{ agents: string[]; rootBlocked: boolean; rootAllowed: boolean }> = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rootBlocked: false, rootAllowed: false }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "disallow" && val === "/") cur.rootBlocked = true;
    if (key === "allow" && val === "/") cur.rootAllowed = true;
  }
  const rule = (agent: string) => groups.find((g) => g.agents.includes(agent.toLowerCase())) ?? groups.find((g) => g.agents.includes("*"));
  return AI_BOTS.filter((b) => { const g = rule(b); return Boolean(g && g.rootBlocked && !g.rootAllowed); });
}

/** Types JSON-LD de la page (« FAQPage », « LocalBusiness »…), y compris dans @graph. */
export function jsonLdTypes(html: string): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(add);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const t = o["@type"];
    for (const x of Array.isArray(t) ? t : [t]) if (typeof x === "string") out.add(x);
    if (o["@graph"]) add(o["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { add(JSON.parse(m[1])); } catch { /* bloc illisible : ignoré */ }
  }
  return [...out];
}

const ORG_TYPES = /^(Organization|LocalBusiness|ProfessionalService|HomeAndConstructionBusiness|MovingCompany|Store|.*Business)$/;

export function readiness(input: { robots: string | null; llmsTxt: boolean; homeHtml: string | null }): Readiness {
  const types = input.homeHtml ? jsonLdTypes(input.homeHtml) : [];
  return {
    blockedBots: input.robots ? blockedAiBots(input.robots) : [],
    llmsTxt: input.llmsTxt,
    faq: types.includes("FAQPage"),
    organization: types.some((t) => ORG_TYPES.test(t)),
  };
}

// ---------------------------------------------------------------------------
// Conseils et questions proposées
// ---------------------------------------------------------------------------

export type Advice = { kind: "article" | "faq" | "robots" | "llms" | "organization"; text: string; question?: string };

/**
 * À faire, du plus utile au moins utile : ouvrir le site aux robots des IA, puis un article pour chaque
 * question où aucune IA ne cite le site, puis la FAQ, l'identité de l'entreprise et llms.txt.
 */
export function adviceFor(questions: Array<{ id: string; question: string }>, checks: CheckLite[], r: Readiness | null, limit = 6): Advice[] {
  const out: Advice[] = [];
  if (r?.blockedBots.length) out.push({ kind: "robots", text: `Votre robots.txt bloque ${r.blockedBots.join(", ")} : ces IA ne peuvent pas lire votre site. Retirez la ligne « Disallow: / » pour elles.` });
  for (const q of questions) {
    const mine = checks.filter((c) => c.questionId === q.id && c.status === "ok");
    if (mine.length && !mine.some((c) => c.cited || c.linked)) {
      out.push({ kind: "article", question: q.question, text: `Aucune IA ne vous cite sur « ${q.question} ». Écrivez un article qui y répond directement, avec des chiffres, des prix et votre région.` });
    }
  }
  if (r && !r.faq) out.push({ kind: "faq", text: "Ajoutez une FAQ structurée (FAQPage) sur votre page d'accueil : les IA reprennent volontiers des réponses courtes et claires." });
  if (r && !r.organization) out.push({ kind: "organization", text: "Décrivez votre entreprise en JSON-LD (Organization ou LocalBusiness : nom, adresse, téléphone) pour que les IA la reconnaissent." });
  if (r && !r.llmsTxt) out.push({ kind: "llms", text: "Ajoutez un fichier /llms.txt qui résume votre activité et liste vos pages importantes." });
  return out.slice(0, limit);
}

const TEMPLATES: Record<Lang, { best: (t: string) => string; price: (k: string) => string; who: (k: string) => string; how: (k: string) => string }> = {
  fr: { best: (t) => `Quelle est la meilleure entreprise de ${t} ?`, price: (k) => `Combien coûte ${k} ?`, who: (k) => `Quelle entreprise me conseilles-tu pour « ${k} » ?`, how: (k) => `Que dois-je savoir sur « ${k} » ?` },
  de: { best: (t) => `Welche ist die beste Firma für ${t}?`, price: (k) => `Was kostet ${k}?`, who: (k) => `Welche Firma empfiehlst du für «${k}»?`, how: (k) => `Was muss ich über «${k}» wissen?` },
  it: { best: (t) => `Qual è la migliore azienda di ${t}?`, price: (k) => `Quanto costa ${k}?`, who: (k) => `Quale azienda mi consigli per «${k}»?`, how: (k) => `Cosa devo sapere su «${k}»?` },
  en: { best: (t) => `What is the best ${t} company?`, price: (k) => `How much does ${k} cost?`, who: (k) => `Which company do you recommend for "${k}"?`, how: (k) => `What should I know about "${k}"?` },
};

/**
 * Questions proposées à partir du sujet du site et des mots-clés du calendrier, sans doublon avec
 * celles déjà suivies. Le client les relit et les change.
 */
export function suggestQuestions(input: { theme: string; keywords: string[]; language: Lang; existing: string[] }, limit = 10): string[] {
  const t = TEMPLATES[input.language] ?? TEMPLATES.fr;
  const seen = new Set(input.existing.map(norm));
  const out: string[] = [];
  const push = (q: string) => {
    const k = norm(q);
    if (q.length < 5 || q.length > 300 || seen.has(k)) return;
    seen.add(k);
    out.push(q);
  };
  const theme = input.theme.trim();
  if (theme) push(t.best(theme));
  const kws = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))];
  const forms = [t.who, t.how];
  for (let round = 0; round < forms.length && out.length < limit; round++) {
    for (const k of kws) { if (out.length >= limit) break; push(forms[round](k)); }
  }
  if (theme && out.length < limit) push(t.price(theme));
  return out.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Mode démo : réponses d'exemple, toujours les mêmes pour une question et une IA
// ---------------------------------------------------------------------------

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Réponse d'exemple (sans appel à une IA) : la page montre à quoi elle ressemblera. */
export function sampleAnswer(question: string, engine: AiEngine, site: Entity, competitors: Entity[], week: string): AiAnswer {
  const h = hash(`${question}|${engine}|${week}`);
  const pool = competitors.length ? competitors : [{ name: "Exemple Services", domain: "exemple-services.ch" }, { name: "Alpha Conseil", domain: "alpha-conseil.ch" }];
  const names = pool.slice(0, 3).map((c) => `${c.name || c.domain} (${c.domain})`);
  const place = h % 4; // 0 : absent ; 1–3 : place dans la liste
  if (place > 0) names.splice(Math.min(place - 1, names.length), 0, `${site.name || site.domain} (${site.domain})`);
  const text = `Réponse d'exemple à « ${question} ». Voici quelques entreprises souvent recommandées :\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}\nComparez plusieurs offres avant de choisir.`;
  const sources = pool.slice(0, 2).map((c) => `https://${c.domain}/`);
  if (h % 3 === 0) sources.push(`https://${site.domain}/`);
  return { text, sources };
}
