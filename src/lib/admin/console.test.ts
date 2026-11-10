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
