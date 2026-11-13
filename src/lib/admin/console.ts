/**
 * Console super admin : calculs purs (sans réseau), testés dans console.test.ts.
 * Les lignes viennent de la fonction SQL admin_workspaces().
 */

export type WorkspaceRow = {
  id: string; name: string; created_at: string; suspended_at: string | null; suspended_reason: string | null;
  owner_email: string | null; owner_last_sign_in: string | null;
  plan_code: string | null; sub_status: string | null; trial_ends_at: string | null; period_start: string | null;
  price_month_cents: number | null; articles_per_month: number | null;
  sites: number; site_url: string | null;
  articles_period: number; articles_30d: number; articles_total: number;
  ai_cost_period_micro: number; ai_cost_30d_micro: number; ai_cost_total_micro: number;
  failed_items: number; last_article_at: string | null;
};

export type Status = "trial" | "trial_ended" | "active" | "past_due" | "canceled" | "suspended";
export type Health = "ok" | "watch" | "risk";

export type Client = {
  id: string; name: string; email: string | null; siteUrl: string | null; sites: number; createdAt: string;
  plan: string | null; status: Status; trialDaysLeft: number | null; suspendedReason: string | null;
  /** Revenu mensuel (CHF) : 0 pendant l'essai. */
  revenueChf: number;
  /** Prix mensuel de son offre (CHF), qu'il paie déjà ou non. */
  priceChf: number;
  /** Coût IA des 30 derniers jours (CHF). */
  aiCost30Chf: number;
  marginChf: number;
  /** Marge en % du revenu ; null sans revenu. */
  marginPct: number | null;
  articlesPeriod: number; quota: number; articles30d: number; articlesTotal: number; costPerArticleChf: number | null;
  lastSignIn: string | null; lastArticleAt: string | null; failed: number;
  health: Health; reasons: string[];
};

/** Taux indicatif dollar → franc (les coûts de l'API sont en dollars). Réglable : USD_CHF. */
export const DEFAULT_USD_CHF = 0.8;

const DAY = 86_400_000;

export function statusOf(r: Pick<WorkspaceRow, "suspended_at" | "sub_status" | "trial_ends_at">, now: Date): { status: Status; trialDaysLeft: number | null } {
  if (r.suspended_at) return { status: "suspended", trialDaysLeft: null };
  if (r.sub_status === "trialing") {
    const left = r.trial_ends_at ? Math.ceil((new Date(r.trial_ends_at).getTime() - now.getTime()) / DAY) : null;
    if (left !== null && left <= 0) return { status: "trial_ended", trialDaysLeft: 0 };
    return { status: "trial", trialDaysLeft: left };
  }
  if (r.sub_status === "active") return { status: "active", trialDaysLeft: null };
  if (r.sub_status === "past_due") return { status: "past_due", trialDaysLeft: null };
  return { status: "canceled", trialDaysLeft: null };
}

export function toClient(r: WorkspaceRow, now: Date, usdChf = DEFAULT_USD_CHF): Client {
  const { status, trialDaysLeft } = statusOf(r, now);
  const paying = status === "active" || status === "past_due";
  const revenueChf = paying ? (r.price_month_cents ?? 0) / 100 : 0;
  const aiCost30Chf = (r.ai_cost_30d_micro / 1_000_000) * usdChf;
  const marginChf = revenueChf - aiCost30Chf;
  const reasons: string[] = [];
  let health: Health = "ok";
  const flag = (level: Health, why: string) => {
    reasons.push(why);
    if (level === "risk" || health === "ok") health = level;
  };
  if (status !== "suspended") {
    if (r.failed_items > 0) flag("risk", `${r.failed_items} échec${r.failed_items > 1 ? "s" : ""} à traiter`);
    if (status === "past_due") flag("risk", "paiement en retard");
    if (paying && revenueChf > 0 && aiCost30Chf > revenueChf * 0.5) flag("risk", "coût IA au-dessus de 50 % du prix");
    if (!paying && aiCost30Chf > 10) flag("watch", "essai qui coûte plus de 10 CHF");
    if (status === "trial" && trialDaysLeft !== null && trialDaysLeft <= 1) flag("watch", "essai qui se termine");
    if (status === "trial_ended") flag("watch", "essai terminé, pas d'abonnement");
    const seen = r.owner_last_sign_in ? (now.getTime() - new Date(r.owner_last_sign_in).getTime()) / DAY : Infinity;
    if (seen > 14) flag("watch", r.owner_last_sign_in ? "pas connecté depuis plus de 14 jours" : "jamais connecté");
    if (r.sites === 0) flag("watch", "pas encore de site");
  }
  return {
    id: r.id, name: r.name, email: r.owner_email, siteUrl: r.site_url, sites: r.sites, createdAt: r.created_at,
    plan: r.plan_code, status, trialDaysLeft, suspendedReason: r.suspended_reason,
    revenueChf, priceChf: (r.price_month_cents ?? 0) / 100, aiCost30Chf, marginChf, marginPct: revenueChf > 0 ? Math.round((marginChf / revenueChf) * 100) : null,
    articlesPeriod: r.articles_period, quota: r.articles_per_month ?? 0, articles30d: r.articles_30d, articlesTotal: r.articles_total,
    costPerArticleChf: r.articles_total ? ((r.ai_cost_total_micro / 1_000_000) * usdChf) / r.articles_total : null,
    lastSignIn: r.owner_last_sign_in, lastArticleAt: r.last_article_at, failed: r.failed_items,
    health, reasons,
  };
}

export const FILTERS = [
  ["all", "Tous"], ["trial", "En essai"], ["paying", "Payants"], ["problems", "À surveiller"], ["unprofitable", "Peu rentables"], ["suspended", "Suspendus"],
] as const;
export type FilterKey = (typeof FILTERS)[number][0];

export function matches(c: Client, f: FilterKey, q: string): boolean {
  const okFilter =
    f === "all" ? true
    : f === "trial" ? c.status === "trial" || c.status === "trial_ended"
    : f === "paying" ? c.status === "active" || c.status === "past_due"
    : f === "problems" ? c.health !== "ok"
    : f === "unprofitable" ? c.aiCost30Chf > 0 && (c.revenueChf === 0 ? c.aiCost30Chf > 10 : c.marginChf < c.revenueChf * 0.5)
    : c.status === "suspended";
  if (!okFilter) return false;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [c.name, c.email ?? "", c.siteUrl ?? ""].some((v) => v.toLowerCase().includes(s));
}

export function totals(list: Client[]) {
  const live = list.filter((c) => c.status !== "suspended");
  const paying = live.filter((c) => c.status === "active" || c.status === "past_due");
  const mrr = paying.reduce((n, c) => n + c.revenueChf, 0);
  const cost30 = list.reduce((n, c) => n + c.aiCost30Chf, 0);
  return {
    clients: list.length,
    paying: paying.length,
    trials: live.filter((c) => c.status === "trial").length,
    trialsEnding: live.filter((c) => c.status === "trial" && c.trialDaysLeft !== null && c.trialDaysLeft <= 1).length,
    suspended: list.length - live.length,
    mrr,
    cost30,
    margin: mrr - cost30,
    articles30: list.reduce((n, c) => n + c.articles30d, 0),
    problems: live.filter((c) => c.health !== "ok").length,
  };
}

export function chf(n: number, decimals = n !== 0 && Math.abs(n) < 100): string {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 }).format(n);
}

export const STATUS_LABEL: Record<Status, string> = {
  trial: "Essai", trial_ended: "Essai terminé", active: "Payant", past_due: "Paiement en retard", canceled: "Résilié", suspended: "Suspendu",
};

export const ACTION_LABEL: Record<string, string> = {
  suspend: "Suspension", unsuspend: "Réactivation", extend_trial: "Essai prolongé", set_plan: "Offre changée",
  retry_job: "Tâche relancée", retry_topic: "Sujet relancé",
  create_workspace: "Client créé", delete_workspace: "Client supprimé", set_note: "Note interne modifiée",
  add_admin: "Administrateur ajouté", remove_admin: "Administrateur retiré",
};

/** Résumé lisible d'une ligne du journal. */
export function describe(action: string, data: Record<string, unknown> | null): string {
  const d = data ?? {};
  if (action === "suspend") return `Raison : ${String(d.reason ?? "—")}`;
  if (action === "extend_trial") return `+${String(d.days)} jours, jusqu'au ${d.until ? new Date(String(d.until)).toLocaleDateString("fr-CH") : "—"}`;
  if (action === "set_plan") return `${String(d.from)} → ${String(d.to)}`;
  if (action === "create_workspace") return `${String(d.name ?? "")} · ${String(d.email ?? "")} · offre ${String(d.plan ?? "")}, essai de ${String(d.trial_days ?? "?")} jours`;
  if (action === "delete_workspace") return `${String(d.name ?? "")} · ${String(d.sites ?? 0)} site(s), ${String(d.articles ?? 0)} article(s) effacés`;
  if (action === "add_admin" || action === "remove_admin") return String(d.email ?? "");
  return "";
}

// ---------------------------------------------------------------------------
// Revenus
// ---------------------------------------------------------------------------

export type Revenue = {
  mrr: number; arr: number;
  /** Ce que rapporteraient en plus les essais en cours s'ils s'abonnaient tous. */
  trialPotential: number;
  byPlan: Array<{ plan: string; paying: number; trials: number; mrr: number }>;
  /** Essais qui se terminent dans les 7 jours, le plus proche d'abord. */
  endingSoon: Client[];
  /** Essais terminés sans abonnement : à relancer. */
  lapsed: Client[];
  /** Inscriptions par semaine (lundi), de la plus ancienne à la plus récente. */
  signups: Array<{ week: string; count: number }>;
  /** Part des essais terminés qui paient aujourd'hui ; null tant qu'aucun essai n'est terminé. */
  conversionPct: number | null;
};

const PLAN_ORDER = ["grow", "scale", "agence"];

/** Lundi (UTC) de la semaine d'une date, au format AAAA-MM-JJ. */
export function weekOf(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

export function revenue(list: Client[], now: Date, weeks = 8): Revenue {
  const live = list.filter((c) => c.status !== "suspended");
  const paying = live.filter((c) => c.status === "active" || c.status === "past_due");
  const trials = live.filter((c) => c.status === "trial");
  const mrr = paying.reduce((n, c) => n + c.revenueChf, 0);
  const plans = [...new Set([...PLAN_ORDER, ...live.map((c) => c.plan ?? "")].filter(Boolean))];
  const byPlan = plans.map((plan) => ({
    plan,
    paying: paying.filter((c) => c.plan === plan).length,
    trials: trials.filter((c) => c.plan === plan).length,
    mrr: paying.filter((c) => c.plan === plan).reduce((n, c) => n + c.revenueChf, 0),
  })).filter((p) => p.paying || p.trials || PLAN_ORDER.includes(p.plan));
  const first = weekOf(new Date(now.getTime() - (weeks - 1) * 7 * DAY));
  const signups: Revenue["signups"] = [];
  for (let i = 0; i < weeks; i++) signups.push({ week: weekOf(new Date(new Date(`${first}T00:00:00Z`).getTime() + i * 7 * DAY)), count: 0 });
  for (const c of list) { const row = signups.find((x) => x.week === weekOf(new Date(c.createdAt))); if (row) row.count++; }
  const lapsed = live.filter((c) => c.status === "trial_ended");
  const decided = paying.length + lapsed.length + live.filter((c) => c.status === "canceled").length;
  return {
    mrr, arr: mrr * 12,
    trialPotential: trials.reduce((n, c) => n + c.priceChf, 0),
    byPlan,
    endingSoon: trials.filter((c) => c.trialDaysLeft !== null && c.trialDaysLeft <= 7).sort((a, b) => (a.trialDaysLeft ?? 0) - (b.trialDaysLeft ?? 0)),
    lapsed,
    signups,
    conversionPct: decided ? Math.round((paying.length / decided) * 100) : null,
  };
}

export const PLAN_LABEL: Record<string, string> = { grow: "Grow", scale: "Scale", agence: "Agence" };

// ---------------------------------------------------------------------------
// Fiche d'un client et administrateurs (lignes renvoyées par la base)
// ---------------------------------------------------------------------------

export type ClientDetail = {
  members: Array<{ email: string | null; role: string; last_sign_in: string | null; joined: string }>;
  sites: Array<{ id: string; name: string; url: string; configured: boolean; language: string; publish_mode: string; integration: string | null; integration_simulated: boolean; articles: number; published: number; topics_approved: number }>;
  usage: { images: number; ads: number; ads_approved: number; rank_keywords: number; ai_questions: number; search_connected: boolean };
  note: string | null; note_at: string | null;
};
export type AdminRow = { user_id: string; email: string | null; added_at: string; added_by_email: string | null; last_sign_in: string | null; mfa_ready: boolean; is_me: boolean };

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
