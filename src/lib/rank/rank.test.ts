import { test } from "node:test";
import assert from "node:assert/strict";
import { findRank, locationOf, movement, sampleRank, sameSite, searchGoogle, summarize } from "./serp.ts";
import { indexNowMessage, keyFileUrl, keyMatches, parseUrls, submitIndexNow } from "./indexnow.ts";
import { readInspection } from "../search/google.ts";

const items = [
  { type: "paid", rank_group: 1, domain: "pub.ch", url: "https://pub.ch" },
  { type: "organic", rank_group: 2, domain: "rival.ch", title: "Rival", url: "https://rival.ch/" },
  { type: "organic", rank_group: 1, domain: "annuaire.ch", title: "Annuaire", url: "https://annuaire.ch/x" },
  { type: "local_pack", rank_group: 1, domain: "domevia.ch" },
  { type: "organic", rank_group: 7, domain: "www.domevia.ch", title: "Domevia", url: "https://www.domevia.ch/fin-de-bail/" },
];

test("position : résultats naturels seulement, avec ou sans www, et les 3 premiers", () => {
  const r = findRank(items, "domevia.ch");
  assert.equal(r.position, 7);
  assert.equal(r.url, "https://www.domevia.ch/fin-de-bail/");
  assert.deepEqual(r.top.map((t) => t.domain), ["annuaire.ch", "rival.ch", "domevia.ch"]);
  assert.equal(findRank(items, "absent.ch").position, null);
  assert.ok(sameSite("blog.domevia.ch", "domevia.ch") && !sameSite("faux-domevia.ch", "domevia.ch"));
});

test("pays de la recherche d'après le domaine, Suisse par défaut", () => {
  assert.deepEqual(locationOf("domevia.ch"), { code: 2756, country: "CH" });
  assert.equal(locationOf("exemple.fr").code, 2250);
  assert.equal(locationOf("exemple.com").country, "CH");
});

test("évolution et chiffres du haut de page", () => {
  assert.deepEqual(movement(3, 7), { kind: "up", by: 4 });
  assert.deepEqual(movement(9, 4), { kind: "down", by: 5 });
  assert.equal(movement(5, null).kind, "new");
  assert.equal(movement(null, 12).kind, "lost");
  assert.equal(movement(5, undefined).kind, "none");
  assert.deepEqual(summarize([1, 3, 8, 25, null]), { tracked: 5, top3: 2, top10: 3, top50: 4, average: 9.3 });
  assert.equal(summarize([null]).average, null);
});

test("positions d'exemple : stables pour une semaine, le site en gras dans le top 3 s'il y est", () => {
  const a = sampleRank("déménagement neuchâtel", "2026-11-09", "domevia.ch", ["rival.ch"]);
  assert.deepEqual(a, sampleRank("déménagement neuchâtel", "2026-11-09", "domevia.ch", ["rival.ch"]));
  if (a.position && a.position <= 3) assert.equal(a.top[a.position - 1].domain, "domevia.ch");
});

test("DataForSEO : requête envoyée, réponse lue, identifiants absents des erreurs", async () => {
  process.env.DATAFORSEO_LOGIN = "moi@x.ch"; process.env.DATAFORSEO_PASSWORD = "secret";
  let sent: { url: string; body: unknown; auth: string } | null = null;
  const ok = await searchGoogle(async (url, init) => {
    sent = { url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).authorization) };
    return new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items }] }] }), { status: 200 });
  }, { keyword: "fin de bail", language: "fr", location: 2756, host: "domevia.ch" });
  assert.ok(ok.ok && ok.value.position === 7);
  assert.equal(sent!.url, "https://api.dataforseo.com/v3/serp/google/organic/live/regular");
  assert.deepEqual((sent!.body as Array<Record<string, unknown>>)[0], { keyword: "fin de bail", location_code: 2756, language_code: "fr", depth: 50, device: "desktop" });
  assert.equal(sent!.auth, "Basic " + Buffer.from("moi@x.ch:secret").toString("base64"));
  const bad = await searchGoogle(async () => new Response(JSON.stringify({ status_code: 40100, status_message: "moi@x.ch secret" }), { status: 401 }), { keyword: "x", language: "fr", location: 2756, host: "a.ch" });
  assert.deepEqual(bad, { ok: false, error: "Identifiants DataForSEO refusés." });
  const none = await searchGoogle(async () => new Response(JSON.stringify({ status_code: 20000, tasks: [{ status_code: 40102 }] }), { status: 200 }), { keyword: "x", language: "fr", location: 2756, host: "a.ch" });
  assert.deepEqual(none, { ok: true, value: { position: null, url: null, top: [] } });
});

test("IndexNow : adresses du site seulement, fichier de clé, envoi", async () => {
  assert.deepEqual(parseUrls("https://domevia.ch/a/\ndomevia.ch/b#haut, https://autre.ch/x https://domevia.ch/a/", "https://domevia.ch"), {
    urls: ["https://domevia.ch/a/", "https://domevia.ch/b"], rejected: ["https://autre.ch/x"],
  });
  assert.equal(parseUrls(Array.from({ length: 150 }, (_, i) => `https://domevia.ch/${i}`).join("\n"), "https://domevia.ch").urls.length, 100);
  assert.equal(keyFileUrl("https://domevia.ch/blog/", "abc12345"), "https://domevia.ch/abc12345.txt");
  assert.ok(keyMatches(" abc12345\n", "abc12345") && !keyMatches("<html>abc12345</html>", "abc12345"));
  assert.equal(indexNowMessage(202).ok, true);
  assert.equal(indexNowMessage(403).ok, false);
  let body: Record<string, unknown> = {};
  const r = await submitIndexNow(async (_u, init) => { body = JSON.parse(String(init.body)); return new Response(null, { status: 200 }); }, "https://domevia.ch", "abc12345", ["https://domevia.ch/a/"]);
  assert.equal(r.ok, true);
  assert.deepEqual(body, { host: "domevia.ch", key: "abc12345", keyLocation: "https://domevia.ch/abc12345.txt", urlList: ["https://domevia.ch/a/"] });
});

test("inspection d'URL : réponse de Google lue, champs inconnus ignorés", () => {
  const i = readInspection({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Envoyée et indexée", lastCrawlTime: "2026-11-10T08:00:00Z", googleCanonical: "https://domevia.ch/", robotsTxtState: "ALLOWED", indexingState: "INDEXING_ALLOWED", pageFetchState: "SUCCESSFUL" } } });
  assert.equal(i.verdict, "PASS");
  assert.equal(i.lastCrawlAt, "2026-11-10T08:00:00.000Z");
  assert.equal(readInspection({ inspectionResult: { indexStatusResult: { verdict: "BIZARRE", lastCrawlTime: "pas une date" } } }).verdict, null);
  assert.equal(readInspection(null).coverage, null);
});
