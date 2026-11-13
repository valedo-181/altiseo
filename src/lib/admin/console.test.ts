import { test } from "node:test";
import assert from "node:assert/strict";
import { chf, describe, matches, statusOf, toClient, totals, type WorkspaceRow } from "./console.ts";

const now = new Date("2026-11-10T12:00:00Z");
const base: WorkspaceRow = {
  id: "w1", name: "Atelier", created_at: "2026-11-01T10:00:00Z", suspended_at: null, suspended_reason: null,
  owner_email: "a@ex.ch", owner_last_sign_in: "2026-11-09T10:00:00Z",
  plan_code: "grow", sub_status: "active", trial_ends_at: null, period_start: "2026-11-01T00:00:00Z",
  price_month_cents: 9900, articles_per_month: 30, sites: 1, site_url: "https://ex.ch",
  articles_period: 12, articles_30d: 20, articles_total: 20,
  ai_cost_period_micro: 2_000_000, ai_cost_30d_micro: 3_000_000, ai_cost_total_micro: 3_000_000,
  failed_items: 0, last_article_at: "2026-11-10T07:00:00Z",
};

test("statut : essai, essai terminé, payant, suspendu", () => {
  assert.deepEqual(statusOf({ ...base, sub_status: "trialing", trial_ends_at: "2026-11-12T12:00:00Z" }, now), { status: "trial", trialDaysLeft: 2 });
  assert.equal(statusOf({ ...base, sub_status: "trialing", trial_ends_at: "2026-11-09T12:00:00Z" }, now).status, "trial_ended");
  assert.equal(statusOf(base, now).status, "active");
  assert.equal(statusOf({ ...base, suspended_at: "2026-11-05T00:00:00Z" }, now).status, "suspended");
});

test("revenu, coût et marge en francs", () => {
  const c = toClient(base, now, 0.8);
  assert.equal(c.revenueChf, 99);
  assert.equal(Math.round(c.aiCost30Chf * 100) / 100, 2.4);
  assert.equal(Math.round(c.marginChf * 100) / 100, 96.6);
  assert.equal(c.marginPct, 98);
  assert.equal(Math.round(c.costPerArticleChf! * 100), 12);
  assert.equal(c.health, "ok");
  // Essai : pas de revenu, pas de pourcentage de marge
  const t = toClient({ ...base, sub_status: "trialing", trial_ends_at: "2026-11-13T00:00:00Z" }, now);
  assert.equal(t.revenueChf, 0);
  assert.equal(t.marginPct, null);
});

test("santé : échecs, coût élevé, inactivité, essai qui finit", () => {
  assert.equal(toClient({ ...base, failed_items: 2 }, now).health, "risk");
  assert.equal(toClient({ ...base, ai_cost_30d_micro: 70_000_000 }, now).health, "risk"); // 56 CHF > 50 % de 99
  const idle = toClient({ ...base, owner_last_sign_in: "2026-10-01T00:00:00Z" }, now);
  assert.equal(idle.health, "watch");
  assert.match(idle.reasons.join(), /14 jours/);
  assert.equal(toClient({ ...base, sub_status: "trialing", trial_ends_at: "2026-11-11T06:00:00Z" }, now).health, "watch");
  assert.equal(toClient({ ...base, suspended_at: "2026-11-05T00:00:00Z", failed_items: 3 }, now).health, "ok"); // suspendu : rien à signaler
});

test("filtres, recherche et totaux", () => {
  const list = [
    toClient(base, now),
    toClient({ ...base, id: "w2", name: "Boutique", owner_email: "b@ex.ch", sub_status: "trialing", trial_ends_at: "2026-11-11T00:00:00Z", ai_cost_30d_micro: 15_000_000 }, now),
    toClient({ ...base, id: "w3", name: "Cave", suspended_at: "2026-11-05T00:00:00Z" }, now),
  ];
  assert.deepEqual(list.filter((c) => matches(c, "trial", "")).map((c) => c.id), ["w2"]);
  assert.deepEqual(list.filter((c) => matches(c, "paying", "")).map((c) => c.id), ["w1"]);
  assert.deepEqual(list.filter((c) => matches(c, "unprofitable", "")).map((c) => c.id), ["w2"]);
  assert.deepEqual(list.filter((c) => matches(c, "all", "B@EX")).map((c) => c.id), ["w2"]);
  const t = totals(list);
  assert.equal(t.mrr, 99);
  assert.equal(t.paying, 1);
  assert.equal(t.trials, 1);
  assert.equal(t.trialsEnding, 1);
  assert.equal(t.suspended, 1);
});

test("affichage", () => {
  assert.equal(chf(99).replace(/\s/g, " "), "99.00 CHF");
  assert.equal(chf(1250).replace(/[\s’']/g, ""), "1250CHF");
  assert.equal(describe("set_plan", { from: "grow", to: "scale" }), "grow → scale");
  assert.equal(describe("suspend", { reason: "Impayé" }), "Raison : Impayé");
});

test("revenus : par offre, potentiel des essais, essais à suivre, inscriptions par semaine", async () => {
  const { revenue, weekOf } = await import("./console.ts");
  const now = new Date("2026-11-13T10:00:00Z"); // un vendredi
  const base: WorkspaceRow = {
    id: "x", name: "X", created_at: "2026-11-10T08:00:00Z", suspended_at: null, suspended_reason: null, owner_email: "a@b.ch", owner_last_sign_in: "2026-11-12T08:00:00Z",
    plan_code: "grow", sub_status: "trialing", trial_ends_at: "2026-11-16T08:00:00Z", period_start: "2026-11-01T00:00:00Z", price_month_cents: 9900, articles_per_month: 30,
    sites: 1, site_url: "https://x.ch", articles_period: 0, articles_30d: 0, articles_total: 0, ai_cost_period_micro: 0, ai_cost_30d_micro: 0, ai_cost_total_micro: 0, failed_items: 0, last_article_at: null,
  };
  const mk = (o: Partial<WorkspaceRow>) => toClient({ ...base, ...o }, now);
  const list = [
    mk({ id: "p1", plan_code: "grow", sub_status: "active", created_at: "2026-10-01T08:00:00Z" }),
    mk({ id: "p2", plan_code: "agence", price_month_cents: 69000, sub_status: "active", created_at: "2026-10-06T08:00:00Z" }),
    mk({ id: "t1", plan_code: "scale", price_month_cents: 24900, trial_ends_at: "2026-11-15T08:00:00Z" }),
    mk({ id: "t2", trial_ends_at: "2026-12-20T08:00:00Z", created_at: "2026-11-03T08:00:00Z" }),
    mk({ id: "fini", trial_ends_at: "2026-11-01T08:00:00Z", created_at: "2026-09-01T08:00:00Z" }),
    mk({ id: "susp", sub_status: "active", suspended_at: "2026-11-02T08:00:00Z" }),
  ];
  const r = revenue(list, now);
  assert.equal(r.mrr, 99 + 690);
  assert.equal(r.arr, (99 + 690) * 12);
  assert.equal(r.trialPotential, 249 + 99, "les essais en cours, au prix de leur offre ; l'essai terminé et le suspendu ne comptent pas");
  assert.deepEqual(r.byPlan, [{ plan: "grow", paying: 1, trials: 1, mrr: 99 }, { plan: "scale", paying: 0, trials: 1, mrr: 0 }, { plan: "agence", paying: 1, trials: 0, mrr: 690 }]);
  assert.deepEqual(r.endingSoon.map((c) => c.id), ["t1"], "seulement les essais qui finissent sous 7 jours");
  assert.deepEqual(r.lapsed.map((c) => c.id), ["fini"]);
  assert.equal(r.conversionPct, 67, "2 payants sur 3 essais terminés");
  assert.equal(weekOf(now), "2026-11-09");
  assert.equal(r.signups.length, 8);
  assert.deepEqual(r.signups.at(-1), { week: "2026-11-09", count: 2 }, "t1 et le suspendu se sont inscrits cette semaine");
  assert.equal(r.signups.find((s) => s.week === "2026-11-02")!.count, 1);
  assert.equal(revenue([], now).conversionPct, null);
});

test("journal : les nouvelles actions sont lisibles, sans le texte des notes", async () => {
  const { ACTION_LABEL, describe } = await import("./console.ts");
  assert.equal(ACTION_LABEL.create_workspace, "Client créé");
  assert.match(describe("create_workspace", { name: "Menuiserie", email: "a@b.ch", plan: "scale", trial_days: 14 }), /Menuiserie · a@b\.ch · offre scale, essai de 14 jours/);
  assert.match(describe("delete_workspace", { name: "Menuiserie", sites: 2, articles: 31 }), /2 site\(s\), 31 article\(s\) effacés/);
  assert.equal(describe("add_admin", { email: "c@d.ch" }), "c@d.ch");
  assert.equal(describe("set_note", { length: 20 }), "");
});
