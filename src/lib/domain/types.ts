/**
 * Types métier, alignés sur supabase/migrations (noms en camelCase).
 * La couche de données (src/lib/data) les lit et les écrit ; les écrans ne connaissent qu'eux.
 */

export type Lang = "fr" | "de" | "it" | "en";
export type PublishMode = "draft" | "publish";
export type CalendarStatus = "proposed" | "approved" | "generating" | "done" | "failed" | "skipped";
export type ArticleStatus = "draft" | "scheduled" | "published" | "failed" | "archived";
export type IntegrationKind = "wordpress" | "webflow" | "shopify" | "framer" | "wix" | "ghost" | "webhook";
export type IntegrationStatus = "pending" | "ok" | "error" | "disabled";

export type User = { id: string; email: string; name: string | null; createdAt: string };

export type Workspace = { id: string; name: string; createdAt: string };

export type Subscription = {
  workspaceId: string;
  planCode: "grow" | "scale";
  status: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: string | null;
  currentPeriodStart: string; // ISO
  articlesPerMonth: number;
};

export type Site = {
  id: string;
  workspaceId: string;
  url: string; // https://exemple.ch
  name: string;
  language: Lang;
  theme: string; // sujet principal, ex. « déménagement »
  businessDescription: string;
  targetAudience: string;
  tone: string;
  customInstructions: string;
  mentionCompetitors: boolean;
  publishTime: string; // « 08:00 », heure locale
  timezone: string; // « Europe/Zurich »
  publishDays: number[]; // ISO : 1 = lundi … 7 = dimanche
  publishMode: PublishMode;
  targetWords: number;
  onboardingStep: number; // 1..8 ; 8 = terminé
  analyzedAt: string | null;
  createdAt: string;
};

export type Competitor = { id: string; siteId: string; url: string; name: string; source: "suggested" | "manual" };

export type CalendarItem = {
  id: string;
  siteId: string;
  scheduledFor: string; // AAAA-MM-JJ, jour local du site
  title: string;
  angle: string;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  status: CalendarStatus;
  regenerations: number;
};

export type InternalLink = { url: string; anchor: string };

export type Article = {
  id: string;
  siteId: string;
  calendarItemId: string | null;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  bodyMd: string; // Markdown restreint (voir markdown.ts) ; le HTML est produit à la publication
  language: Lang;
  keywords: string[];
  internalLinks: InternalLink[];
  wordCount: number;
  status: ArticleStatus;
  demo: boolean; // texte d'exemple (mode démo, sans IA)
  publishedAt: string | null;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Integration = {
  id: string;
  siteId: string;
  kind: IntegrationKind;
  status: IntegrationStatus;
  config: { endpoint?: string; username?: string };
  lastError: string | null;
  lastTestedAt: string | null;
  demo: boolean; // connexion simulée : rien n'est envoyé
};

export type Publication = {
  id: string;
  articleId: string;
  integrationId: string;
  remoteId: string | null;
  remoteUrl: string | null;
  status: "pending" | "ok" | "error";
  error: string | null;
  lastAttemptAt: string;
};

export const MAX_REGENERATIONS = 5;
export const MAX_INTERNAL_LINKS = 10;
export const INSTRUCTIONS_MAX = 1000;

export type AuditLevel = "critical" | "warning" | "info";
export type AuditIssue = { code: string; level: AuditLevel; affected: number; total: number; pages: string[]; detail: string | null };
export type AuditRun = {
  id: string; siteId: string; status: "done" | "failed"; pagesCrawled: number; score: number | null;
  speed: { score: number; lcp_ms: number | null } | null; error: string | null; createdAt: string; issues: AuditIssue[];
};

/** Connexion d'un site à Google Search Console (le jeton d'accès n'est jamais dans ce type). */
export type SearchConnection = {
  siteId: string;
  property: string; // « sc-domain:exemple.ch » ou « https://exemple.ch/ »
  status: "ok" | "error";
  lastError: string | null;
  lastSyncedAt: string | null;
  demo: boolean; // chiffres d'exemple (sans compte Google)
};

export type SearchDay = { day: string; clicks: number; impressions: number; position: number | null };
export type SearchQuery = {
  query: string;
  clicks: number;
  impressions: number;
  position: number; // position moyenne sur la période, pondérée par les affichages
  prevPosition: number | null; // même mesure sur la période d'avant ; null = nouveau
  prevClicks: number;
};
export type SearchTotals = { clicks: number; impressions: number; position: number | null };

/** Ce que la page « Mots-clés » affiche. Refait à chaque synchronisation. */
export type SearchReport = {
  from: string; // premier jour du graphique
  to: string; // dernier jour connu de Google
  periodDays: number; // longueur de la période comparée (28)
  days: SearchDay[]; // un point par jour, sans trou
  current: SearchTotals;
  previous: SearchTotals;
  queries: SearchQuery[]; // triées par clics puis affichages
};
