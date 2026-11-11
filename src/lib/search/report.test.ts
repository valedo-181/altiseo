import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "../domain/dates.ts";
import { buildReport, findQuery, matchProperty, percentChange, positionGain, sampleRows, CHART_DAYS, type DayRow, type QueryRow } from "./report.ts";
import { consentUrl, dailyQueries, exchangeCode, GOOGLE_SCOPE, listProperties, refreshAccess } from "./google.ts";

const TO = "2026-11-08";
const day = (n: number) => addDays(TO, -n);

test("le rapport couvre 90 jours sans trou et s'ancre sur le dernier jour connu de Google", () => {
  const rows: DayRow[] = [{ day: TO, clicks: 4, impressions: 100, position: 8 }, { day: day(40), clicks: 1, impressions: 50, position: 20 }];
  const r = buildReport(rows, [], "2026-11-11");
  assert.equal(r.to, TO);
  assert.equal(r.days.length, CHART_DAYS);
  assert.equal(r.days.at(-1)!.clicks, 4);
  assert.equal(r.days[0].day, day(89));
  assert.equal(r.days[1].position, null, "un jour sans affichage n'a pas de position");
  assert.deepEqual(r.current, { clicks: 4, impressions: 100, position: 8 });
  assert.deepEqual(r.previous, { clicks: 1, impressions: 50, position: 20 });
});

test("la position moyenne est pondérée par les affichages", () => {
  const rows: DayRow[] = [{ day: TO, clicks: 0, impressions: 900, position: 2 }, { day: day(1), clicks: 0, impressions: 100, position: 42 }];
  assert.equal(buildReport(rows, [], TO).current.position, 6);
});

test("les recherches comparent les 28 derniers jours aux 28 d'avant", () => {
  const q: QueryRow[] = [
    { day: TO, query: "Garde-meubles Lausanne", clicks: 3, impressions: 40, position: 5 },
    { day: day(27), query: "garde-meubles lausanne", clicks: 1, impressions: 10, position: 10 },
    { day: day(28), query: "garde-meubles lausanne", clicks: 2, impressions: 20, position: 14 },
    { day: day(56), query: "garde-meubles lausanne", clicks: 9, impressions: 99, position: 1 },
    { day: TO, query: "déménagement genève", clicks: 0, impressions: 5, position: 30 },
    { day: day(30), query: "ancienne recherche", clicks: 5, impressions: 50, position: 3 },
  ];
  const r = buildReport([{ day: TO, clicks: 3, impressions: 45, position: 7 }], q, TO);
  assert.deepEqual(r.queries.map((x) => x.query), ["garde-meubles lausanne", "déménagement genève"]);
  const g = r.queries[0];
  assert.deepEqual([g.clicks, g.impressions, g.position, g.prevPosition, g.prevClicks], [4, 50, 6, 14, 2]);
  assert.equal(positionGain(g), 8);
  assert.equal(positionGain(r.queries[1]), null, "nouvelle recherche : pas d'évolution");
});

test("sans donnée Google, le rapport est vide mais daté", () => {
  const r = buildReport([], [], "2026-11-11");
  assert.equal(r.to, "2026-11-08");
  assert.deepEqual(r.current, { clicks: 0, impressions: 0, position: null });
  assert.equal(r.queries.length, 0);
});

test("variation en pourcentage et recherche d'un mot-clé visé", () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(5, 0), null);
  const qs = [{ query: "devis  déménagement", clicks: 1, impressions: 2, position: 4, prevPosition: null, prevClicks: 0 }];
  assert.equal(findQuery(qs, " Devis déménagement ")?.position, 4);
  assert.equal(findQuery(qs, "devis"), null);
  assert.equal(findQuery(qs, ""), null);
});

test("choix de la propriété Search Console du site", () => {
  const p = (siteUrl: string, permissionLevel = "siteOwner") => ({ siteUrl, permissionLevel });
  assert.equal(matchProperty("https://www.exemple.ch", [p("https://exemple.ch/"), p("sc-domain:exemple.ch")]), "sc-domain:exemple.ch");
  assert.equal(matchProperty("https://blog.exemple.ch", [p("sc-domain:exemple.ch"), p("sc-domain:autre.ch")]), "sc-domain:exemple.ch");
  assert.equal(matchProperty("https://exemple.ch", [p("http://exemple.ch/"), p("https://www.exemple.ch/")]), "https://www.exemple.ch/");
  assert.equal(matchProperty("https://exemple.ch", [p("https://exemple.ch/blog/")]), null, "un sous-dossier ne couvre pas le site");
  assert.equal(matchProperty("https://exemple.ch", [p("sc-domain:exemple.ch", "siteUnverifiedUser")]), null, "propriété non validée");
  assert.equal(matchProperty("https://exemple.ch", [p("sc-domain:mple.ch"), p("sc-domain:pasexemple.ch")]), null);
});

test("chiffres d'exemple : stables pour un site, et utilisables par le rapport", () => {
  const a = sampleRows("site-1", ["garde-meubles", "devis déménagement", "cartons"], "2026-11-11");
  assert.deepEqual(a, sampleRows("site-1", ["garde-meubles", "devis déménagement", "cartons"], "2026-11-11"));
  const r = buildReport(a.days, a.queries, "2026-11-11");
  assert.equal(r.queries.length, 3);
  assert.ok(r.current.clicks > 0 && r.current.position! >= 1);
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const client = { clientId: "id", clientSecret: "secret" };

test("Google : l'adresse d'accord demande la lecture seule et un accès durable", () => {
  const u = new URL(consentUrl("id", "https://app.test/app/mots-cles/google/callback", "abc"));
  assert.equal(u.searchParams.get("scope"), GOOGLE_SCOPE);
  assert.equal(u.searchParams.get("access_type"), "offline");
  assert.equal(u.searchParams.get("state"), "abc");
});

test("Google : échange du code, refus sans la bonne portée ou sans accès durable", async () => {
  const ok = await exchangeCode(client, "code", "https://app.test/cb", async () => json(200, { access_token: "a", refresh_token: "r", scope: `openid ${GOOGLE_SCOPE}` }));
  assert.deepEqual(ok, { ok: true, value: { access: "a", refresh: "r" } });
  const noScope = await exchangeCode(client, "code", "https://app.test/cb", async () => json(200, { access_token: "a", refresh_token: "r", scope: "openid" }));
  assert.equal(noScope.ok, false);
  const noRefresh = await exchangeCode(client, "code", "https://app.test/cb", async () => json(200, { access_token: "a", scope: GOOGLE_SCOPE }));
  assert.equal(noRefresh.ok, false);
});

test("Google : accès retiré reconnu, et le secret ne sort pas dans l'erreur", async () => {
  const r = await refreshAccess(client, "jeton-secret", async () => json(400, { error: "invalid_grant", error_description: "jeton-secret révoqué" }));
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.revoked && !r.error.includes("jeton-secret"));
  const down = await listProperties("a", async () => { throw new Error("réseau jeton-secret"); });
  assert.ok(!down.ok && !down.error.includes("jeton-secret"));
});

test("Google : lecture des recherches par jour, lignes mal formées écartées", async () => {
  let sent: { url: string; body: string } | null = null;
  const r = await dailyQueries("a", "sc-domain:exemple.ch", "2026-10-01", "2026-11-08", async (url, init) => {
    sent = { url, body: String(init.body) };
    return json(200, { rows: [{ keys: ["2026-11-08", "garde-meubles"], clicks: 2, impressions: 30, position: 4.25 }, { keys: ["pas-une-date", "x"] }, { keys: ["2026-11-07"] }] });
  });
  assert.deepEqual(r, { ok: true, value: [{ day: "2026-11-08", query: "garde-meubles", clicks: 2, impressions: 30, position: 4.25 }] });
  assert.ok(sent!.url.includes("/sites/sc-domain%3Aexemple.ch/searchAnalytics/query"));
  assert.deepEqual(JSON.parse(sent!.body).dimensions, ["date", "query"]);
  const denied = await dailyQueries("a", "sc-domain:exemple.ch", "2026-10-01", "2026-11-08", async () => json(403, {}));
  assert.equal(denied.ok, false);
});
