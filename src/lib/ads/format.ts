/**
 * Annonces Google Ads et Meta Ads préparées pour un article : les limites des deux régies, le
 * nettoyage de ce que propose la rédaction, des annonces d'exemple (mode démo) et l'export.
 * Fonctions pures, testées dans ads.test.ts. Rien ici ne parle à Google ni à Meta.
 */
export const LIMITS = {
  google: { headline: 30, description: 90, path: 15, minHeadlines: 3, maxHeadlines: 15, minDescriptions: 2, maxDescriptions: 4, maxKeywords: 20, maxNegatives: 15 },
  meta: { primary: 125, headline: 40, description: 30, minPrimary: 1, maxPrimary: 3 },
} as const;

export const META_CTA = { LEARN_MORE: "En savoir plus", CONTACT_US: "Nous contacter", GET_QUOTE: "Obtenir un devis", SIGN_UP: "S'inscrire", BOOK_NOW: "Réserver" } as const;
export type MetaCta = keyof typeof META_CTA;
export const MAX_AD_GENERATIONS = 5;

export type GoogleAd = { headlines: string[]; descriptions: string[]; path1: string; path2: string; keywords: string[]; negatives: string[] };
export type MetaAd = { primaryTexts: string[]; headline: string; description: string; cta: MetaCta };
export type AdSet = { google: GoogleAd; meta: MetaAd };
export type RawAds = { google?: Partial<Record<keyof GoogleAd, unknown>>; meta?: Partial<Record<keyof MetaAd, unknown>> };

/** Longueur comme la comptent les régies : en caractères visibles, pas en octets. */
export const len = (s: string) => [...s].length;
const tidy = (v: unknown) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
const list = (v: unknown) => (Array.isArray(v) ? v.map(tidy).filter(Boolean) : []);
const unique = (xs: string[]) => { const seen = new Set<string>(); return xs.filter((x) => { const k = x.toLowerCase(); return !seen.has(k) && (seen.add(k), true); }); };

/**
 * Règles de Google sur les titres : pas de point d'exclamation, pas de MAJUSCULES pour attirer l'œil,
 * pas de ponctuation répétée. Un titre fautif est corrigé si c'est sans risque, sinon écarté.
 */
function googleHeadline(s: string): string | null {
  const t = s.replace(/!+/g, "").replace(/([?.,;:])\1+/g, "$1").trim();
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 6 && letters === letters.toUpperCase()) return null;
  return t || null;
}
/** Une description : un seul point d'exclamation au plus. */
const googleDescription = (s: string) => { let seen = false; return s.replace(/(\s*)!+/g, (_m, sp: string) => (seen ? "." : ((seen = true), `${sp}!`))).replace(/([?.,;:])\1+/g, "$1"); };
const pathPart = (s: string) => tidy(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Garde ce qui respecte les limites, écarte le reste (on ne coupe jamais une phrase au milieu).
 * Renvoie une erreur lisible s'il n'en reste pas assez pour faire une annonce.
 */
export function cleanAds(raw: RawAds): { ok: true; ads: AdSet } | { ok: false; error: string } {
  const g = LIMITS.google, m = LIMITS.meta;
  const headlines = unique(list(raw.google?.headlines).map(googleHeadline).filter((h): h is string => !!h && len(h) <= g.headline)).slice(0, g.maxHeadlines);
  const descriptions = unique(list(raw.google?.descriptions).map(googleDescription).filter((d) => len(d) <= g.description)).slice(0, g.maxDescriptions);
  if (headlines.length < g.minHeadlines) return { ok: false, error: `Il faut au moins ${g.minHeadlines} titres Google de ${g.headline} caractères au plus.` };
  if (descriptions.length < g.minDescriptions) return { ok: false, error: `Il faut au moins ${g.minDescriptions} descriptions Google de ${g.description} caractères au plus.` };
  const keywords = unique(list(raw.google?.keywords).map((k) => k.toLowerCase().replace(/["[\]+]/g, "").trim()).filter((k) => k && len(k) <= 80 && k.split(" ").length <= 10)).slice(0, g.maxKeywords);
  if (!keywords.length) return { ok: false, error: "Il faut au moins un mot-clé pour l'annonce Google." };
  const negatives = unique(list(raw.google?.negatives).map((k) => k.toLowerCase().replace(/^-+/, "").trim()).filter((k) => k && len(k) <= 80 && !keywords.includes(k))).slice(0, g.maxNegatives);
  const fit = (s: string) => (len(s) <= g.path ? s : "");

  const primaryTexts = unique(list(raw.meta?.primaryTexts).filter((t) => len(t) <= m.primary)).slice(0, m.maxPrimary);
  const headline = tidy(raw.meta?.headline), description = tidy(raw.meta?.description);
  if (primaryTexts.length < m.minPrimary) return { ok: false, error: `Il faut au moins un texte Meta de ${m.primary} caractères au plus.` };
  if (!headline || len(headline) > m.headline) return { ok: false, error: `Le titre Meta doit tenir en ${m.headline} caractères.` };
  const cta = (Object.keys(META_CTA) as MetaCta[]).find((c) => c === raw.meta?.cta) ?? "LEARN_MORE";

  return { ok: true, ads: {
    google: { headlines, descriptions, path1: fit(pathPart(String(raw.google?.path1 ?? ""))), path2: fit(pathPart(String(raw.google?.path2 ?? ""))), keywords, negatives },
    meta: { primaryTexts, headline, description: len(description) <= m.description ? description : "", cta },
  } };
}

/**
 * Mode démo (sans IA) : des annonces sobres tirées du mot-clé et du nom de l'entreprise. Chaque texte
 * existe en version longue et courte ; cleanAds écarte celles qui dépassent (aucune phrase n'est coupée).
 */
export function demoAds(a: { title: string; keyword: string; siteName: string; theme: string }): AdSet {
  const kw = tidy(a.keyword) || tidy(a.theme) || "nos services";
  const Kw = kw.charAt(0).toUpperCase() + kw.slice(1);
  const name = tidy(a.siteName), title = tidy(a.title);
  const r = cleanAds({
    google: {
      headlines: [Kw, name, title, `Conseils ${kw}`, `Guide ${kw}`, "Devis gratuit sous 24 h", "Une équipe à votre écoute", "Nos conseils pratiques", "Demandez votre devis", "Le guide complet"],
      descriptions: [
        `${Kw} : nos conseils pratiques pour bien préparer votre projet.`,
        `${name} vous accompagne du premier contact à la fin du projet.`,
        "Nos conseils pratiques pour bien préparer votre projet, étape par étape.",
        "Une équipe à votre écoute, du premier contact à la fin du projet. Demandez votre devis.",
      ],
      path1: kw.split(" ")[0], path2: "conseils", keywords: [kw, `${kw} prix`, `${kw} devis`, `conseils ${kw}`], negatives: ["gratuit", "emploi", "formation"],
    },
    meta: {
      primaryTexts: [
        `${Kw} : ce qu'il faut savoir avant de commencer. Notre guide répond aux questions les plus fréquentes.`,
        `${Kw} : lisez nos conseils, puis demandez votre devis en quelques clics.`,
        "Ce qu'il faut savoir avant de commencer : notre guide répond aux questions les plus fréquentes.",
      ],
      headline: len(title) <= LIMITS.meta.headline ? title : len(Kw) <= LIMITS.meta.headline ? Kw : "Nos conseils pratiques",
      description: len(name) <= LIMITS.meta.description ? name : "", cta: "LEARN_MORE",
    },
  });
  if (!r.ok) throw new Error(r.error);
  return r.ads;
}

/** Adresse de destination avec le suivi de campagne (visible dans les statistiques du site). */
export function landingUrl(base: string, network: "google" | "meta", slug: string): string {
  const u = new URL(base);
  u.searchParams.set("utm_source", network === "google" ? "google" : "meta");
  u.searchParams.set("utm_medium", network === "google" ? "cpc" : "paid_social");
  u.searchParams.set("utm_campaign", slug.slice(0, 60));
  return u.toString();
}

const csvCell = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""'); // pas de formule exécutée par le tableur
const csvRow = (cells: string[]) => cells.map((c) => `"${csvCell(c)}"`).join(",");

/**
 * Fichier à importer dans Google Ads Editor : une annonce responsive et ses mots-clés, dans une
 * campagne créée EN PAUSE. Mots-clés en expression exacte (« phrase ») ; exclusions à part.
 */
export function googleEditorCsv(a: { campaign: string; adGroup: string; url: string; ad: GoogleAd }): string {
  const H = LIMITS.google.maxHeadlines, D = LIMITS.google.maxDescriptions;
  const head = ["Campaign", "Campaign Status", "Ad Group", "Ad Group Status", "Ad type", "Status", ...Array.from({ length: H }, (_, i) => `Headline ${i + 1}`), ...Array.from({ length: D }, (_, i) => `Description ${i + 1}`), "Path 1", "Path 2", "Final URL", "Keyword", "Criterion Type"];
  const blank = (n: number) => Array.from({ length: n }, () => "");
  const pad = (xs: string[], n: number) => [...xs, ...blank(n - xs.length)];
  const base = [a.campaign, "Paused", a.adGroup, "Enabled"];
  const rows = [
    csvRow(head),
    csvRow([...base, "Responsive search ad", "Paused", ...pad(a.ad.headlines, H), ...pad(a.ad.descriptions, D), a.ad.path1, a.ad.path2, a.url, "", ""]),
    ...a.ad.keywords.map((k) => csvRow([...base, "", "Enabled", ...blank(H + D + 3), k, "Phrase"])),
    ...a.ad.negatives.map((k) => csvRow([...base, "", "Enabled", ...blank(H + D + 3), k, "Negative Phrase"])),
  ];
  return "﻿" + rows.join("\r\n") + "\r\n";
}
