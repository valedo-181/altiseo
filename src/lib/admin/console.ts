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
    revenueChf, aiCost30Chf, marginChf, marginPct: revenueChf > 0 ? Math.round((marginChf / revenueChf) * 100) : null,
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
};

/** Résumé lisible d'une ligne du journal. */
export function describe(action: string, data: Record<string, unknown> | null): string {
  const d = data ?? {};
  if (action === "suspend") return `Raison : ${String(d.reason ?? "—")}`;
  if (action === "extend_trial") return `+${String(d.days)} jours, jusqu'au ${d.until ? new Date(String(d.until)).toLocaleDateString("fr-CH") : "—"}`;
  if (action === "set_plan") return `${String(d.from)} → ${String(d.to)}`;
  return "";
}
