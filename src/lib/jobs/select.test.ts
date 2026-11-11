import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDue, type DueTopic } from "./select.ts";

const t = (over: Partial<DueTopic>): DueTopic => ({ workspaceId: "w1", siteId: "s1", itemId: "i", scheduledFor: "2026-11-12", publishTime: "08:00", timezone: "Europe/Zurich", articlesLeft: 5, ...over });
const at = (iso: string) => new Date(iso);

test("passage quotidien : le sujet du jour est traité, celui de demain attend", () => {
  const r = selectDue([t({ itemId: "aujourd'hui" }), t({ itemId: "demain", scheduledFor: "2026-11-13" })], at("2026-11-12T04:00:00Z"), "daily");
  assert.deepEqual(r.run.map((x) => x.itemId), ["aujourd'hui"]);
});

test("le jour se juge dans le fuseau du site", () => {
  // 23 h 30 UTC le 11 = 0 h 30 le 12 à Zurich, mais encore le 11 à New York
  const now = at("2026-11-11T23:30:00Z");
  assert.equal(selectDue([t({})], now, "daily").run.length, 1);
  assert.equal(selectDue([t({ timezone: "America/New_York" })], now, "daily").run.length, 0);
});

test("passage horaire : on attend l'heure de publication du site", () => {
  assert.equal(selectDue([t({})], at("2026-11-12T06:30:00Z"), "hourly").run.length, 0, "7 h 30 à Zurich : trop tôt");
  assert.equal(selectDue([t({})], at("2026-11-12T07:05:00Z"), "hourly").run.length, 1, "8 h 05 à Zurich");
});

test("rattrapage limité à deux jours", () => {
  const rows = [t({ itemId: "hier", scheduledFor: "2026-11-11" }), t({ itemId: "avant-hier", scheduledFor: "2026-11-10" }), t({ itemId: "trop vieux", scheduledFor: "2026-11-09" })];
  assert.deepEqual(selectDue(rows, at("2026-11-12T04:00:00Z"), "daily").run.map((x) => x.itemId), ["avant-hier", "hier"]);
});

test("jamais plus que le quota restant de l'espace", () => {
  const rows = [t({ itemId: "a", scheduledFor: "2026-11-11", articlesLeft: 1 }), t({ itemId: "b", articlesLeft: 1 }), t({ itemId: "c", workspaceId: "w2", articlesLeft: 0 }), t({ itemId: "d", workspaceId: "w3", siteId: "s3" })];
  const r = selectDue(rows, at("2026-11-12T04:00:00Z"), "daily");
  assert.deepEqual(r.run.map((x) => x.itemId), ["a", "d"]);
  assert.equal(r.noQuota, 2);
});
