import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPath, deviceOf, isBot, nameOfHost, parseHit, snippet, sourceOf, visitorHash } from "./collect.ts";
import { change, countryName, fillDays, periodOf, receiving, top, totals } from "./summary.ts";

const KEY = "0123456789abcdef0123456789abcdef";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";

test("robots et outils ignorés, vrais navigateurs gardés", () => {
  assert.equal(isBot(UA), false);
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBot("curl/8.4.0"), true);
  assert.equal(isBot(""), true);
  assert.equal(isBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0 Safari/537.36"), true);
});

test("chemin sans paramètres, ancre, index.html ni barre finale", () => {
  assert.equal(cleanPath(new URL("https://domevia.ch/?email=a@b.ch#top")), "/");
  assert.equal(cleanPath(new URL("https://domevia.ch/demenagement/")), "/demenagement");
  assert.equal(cleanPath(new URL("https://domevia.ch/blog/index.html")), "/blog");
  assert.equal(cleanPath(new URL("https://domevia.ch/d%C3%A9m%C3%A9nagement")), "/déménagement");
});

test("provenance : utm, Google Ads, moteurs, IA, réseaux, le site lui-même", () => {
  const p = (u: string) => new URL(u);
  assert.equal(sourceOf(p("https://domevia.ch/"), ""), "Direct");
  assert.equal(sourceOf(p("https://domevia.ch/"), "https://www.google.ch/"), "Google");
  assert.equal(sourceOf(p("https://domevia.ch/"), "https://gemini.google.com/app"), "Gemini");
  assert.equal(sourceOf(p("https://domevia.ch/"), "https://chatgpt.com/"), "ChatGPT");
  assert.equal(sourceOf(p("https://domevia.ch/"), "https://l.facebook.com/x"), "Facebook");
  assert.equal(sourceOf(p("https://domevia.ch/tarifs"), "https://www.domevia.ch/"), "Direct", "navigation dans le site");
  assert.equal(sourceOf(p("https://domevia.ch/?utm_source=newsletter"), "https://mail.example.com/"), "Newsletter");
  assert.equal(sourceOf(p("https://domevia.ch/?gclid=abc"), "https://www.google.ch/"), "Google Ads");
  assert.equal(sourceOf(p("https://domevia.ch/"), "https://www.annuaire-local.ch/fiche"), "annuaire-local.ch");
  assert.equal(nameOfHost("www.bing.com"), "Bing");
});

test("appareil d'après la largeur", () => {
  assert.equal(deviceOf(390), "Téléphone");
  assert.equal(deviceOf(820), "Tablette");
  assert.equal(deviceOf(1440), "Ordinateur");
  assert.equal(deviceOf("n'importe"), "Ordinateur");
});

test("empreinte du jour : stable le même jour, différente le lendemain ou sur un autre site", () => {
  const a = visitorHash("secret", "2026-11-13", KEY, "1.2.3.4", UA);
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a, visitorHash("secret", "2026-11-13", KEY, "1.2.3.4", UA));
  assert.notEqual(a, visitorHash("secret", "2026-11-14", KEY, "1.2.3.4", UA));
  assert.notEqual(a, visitorHash("secret", "2026-11-13", "f".repeat(32), "1.2.3.4", UA));
  assert.ok(!a.includes("1.2.3.4"));
});

test("page vue lue : clé, adresse, pays ; refus du reste", () => {
  const h = parseHit(JSON.stringify({ k: KEY, u: "https://domevia.ch/tarifs?x=1", r: "https://www.google.com/", w: 390 }), "CH");
  assert.deepEqual(h, { key: KEY, path: "/tarifs", source: "Google", device: "Téléphone", country: "CH" });
  assert.equal(parseHit(JSON.stringify({ k: "court", u: "https://domevia.ch/" }), "CH"), null);
  assert.equal(parseHit(JSON.stringify({ k: KEY, u: "http://localhost:3000/" }), "CH"), null);
  assert.equal(parseHit(JSON.stringify({ k: KEY, u: "javascript:alert(1)" }), "CH"), null);
  assert.equal(parseHit("pas du json", "CH"), null);
  assert.equal(parseHit("x".repeat(5000), "CH"), null);
  assert.equal(parseHit(JSON.stringify({ k: KEY, u: "https://domevia.ch/" }), "pays")?.country, "??");
});

test("code à coller", () => {
  assert.equal(snippet("https://altiseo.ch/", KEY), `<script defer src="https://altiseo.ch/s.js" data-site="${KEY}"></script>`);
});

test("jours, totaux, écarts, classements", () => {
  const days = fillDays([{ day: "2026-11-02", visitors: 4, pageviews: 10 }], "2026-11-01", "2026-11-03");
  assert.deepEqual(days.map((d) => d.visitors), [0, 4, 0]);
  assert.deepEqual(fillDays([], "2026-10-31", "2026-11-01").map((d) => d.day), ["2026-10-31", "2026-11-01"]);
  assert.deepEqual(totals(days), { visitors: 4, pageviews: 10, perVisitor: 2.5 });
  assert.equal(totals([]).perVisitor, null);
  assert.equal(change(150, 100), 50);
  assert.equal(change(5, 0), null);
  const dims = [
    { day: "2026-11-01", kind: "page" as const, value: "/", visitors: 3, pageviews: 6 },
    { day: "2026-11-02", kind: "page" as const, value: "/", visitors: 1, pageviews: 2 },
    { day: "2026-11-02", kind: "page" as const, value: "/tarifs", visitors: 1, pageviews: 2 },
    { day: "2026-11-02", kind: "source" as const, value: "Google", visitors: 3, pageviews: 0 },
  ];
  assert.deepEqual(top(dims, "page"), [{ value: "/", count: 8, share: 80 }, { value: "/tarifs", count: 2, share: 20 }]);
  assert.deepEqual(top(dims, "source"), [{ value: "Google", count: 3, share: 100 }]);
  assert.equal(periodOf("7"), 7);
  assert.equal(periodOf("12"), 30);
  assert.equal(countryName("CH"), "Suisse");
  assert.equal(countryName("??"), "Inconnu");
  assert.equal(receiving(new Date(Date.now() - 3_600_000).toISOString()), true);
  assert.equal(receiving(null), false);
});
