import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAccent, cleanLogoUrl, compareWeeks, monthBounds, monthLabel, pickMonth, shiftMonth, topMovers, totalDowntimeMs } from "./monthly.ts";

test("mois : bornes, nom, mois d'avant, mois demandé", () => {
  assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(monthLabel("2026-11"), "novembre 2026");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(pickMonth("2026-10", "2026-11-12"), "2026-10");
  assert.equal(pickMonth("2027-01", "2026-11-12"), "2026-11", "pas de mois futur");
  assert.equal(pickMonth("n'importe", "2026-11-12"), "2026-11");
});

test("semaines comparées : dernière du mois contre dernière d'avant", () => {
  assert.deepEqual(compareWeeks(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-30"], "2026-11"), { end: "2026-11-30", start: "2026-10-26" });
  assert.deepEqual(compareWeeks(["2026-11-02", "2026-11-09"], "2026-11"), { end: "2026-11-09", start: "2026-11-02" });
  assert.deepEqual(compareWeeks(["2026-11-09"], "2026-11"), { end: "2026-11-09", start: null });
  assert.deepEqual(compareWeeks([], "2026-11"), { end: null, start: null });
});

test("plus fortes progressions et durée des pannes", () => {
  const m = topMovers([{ phrase: "a", now: 3, before: 9 }, { phrase: "b", now: 12, before: null }, { phrase: "c", now: 8, before: 5 }, { phrase: "d", now: null, before: 4 }]);
  assert.deepEqual(m.map((x) => [x.phrase, x.gain]), [["b", 39], ["a", 6]]);
  assert.equal(totalDowntimeMs([{ startedAt: "2026-10-31T23:00:00Z", endedAt: "2026-11-01T01:00:00Z" }, { startedAt: "2026-11-10T10:00:00Z", endedAt: "2026-11-10T10:30:00Z" }], "2026-11-01", "2026-11-30"), 90 * 60_000);
});

test("marque : couleur et logo contrôlés", () => {
  assert.equal(cleanAccent(" #0F766E "), "#0f766e");
  assert.equal(cleanAccent("red"), null);
  assert.deepEqual(cleanLogoUrl(""), { ok: true, value: null });
  assert.equal(cleanLogoUrl("http://x.ch/logo.png").ok, false);
  assert.equal(cleanLogoUrl("javascript:alert(1)").ok, false);
  assert.deepEqual(cleanLogoUrl("https://agence.ch/logo.svg"), { ok: true, value: "https://agence.ch/logo.svg" });
});
