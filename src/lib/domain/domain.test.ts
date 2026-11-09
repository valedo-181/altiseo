import { test } from "node:test";
import assert from "node:assert/strict";
import { guessLanguage, normalizeSiteUrl, siteNameFromHost } from "./url.ts";
import { slugify, uniqueSlug } from "./slug.ts";
import { addDays, isDue, isoWeekday, localDate, publishDates } from "./dates.ts";
import { escapeHtml, markdownToHtml, safeHref, wordCount } from "./markdown.ts";
import { alternativeDemoTopic, planDemoTopics } from "./plan.ts";
import { clip, writeDemoArticle } from "./write.ts";

test("normalizeSiteUrl accepte les saisies courantes", () => {
  for (const [raw, want] of [
    ["atelier-exemple.ch", "https://atelier-exemple.ch"],
    ["  HTTPS://Atelier-Exemple.CH/  ", "https://atelier-exemple.ch"],
    ["http://www.mon-site.com/blog?x=1", "https://www.mon-site.com"],
    ["münchen.de".normalize(), "https://xn--mnchen-3ya.de"],
  ]) {
    const r = normalizeSiteUrl(raw);
    assert.ok(r.ok, raw);
    assert.equal(r.ok && r.url, want);
  }
});

test("normalizeSiteUrl refuse ce qui n'est pas un site public", () => {
  for (const raw of ["", "localhost", "http://127.0.0.1", "intranet", "site.local", "ftp://site.ch", "https://a:b@site.ch", "site.ch:8080", "mon site.ch", "http://[::1]", "-bad.ch", "site.c0m"]) {
    assert.equal(normalizeSiteUrl(raw).ok, false, raw);
  }
});

test("nom et langue devinés depuis le domaine", () => {
  assert.equal(siteNameFromHost("atelier-exemple.ch"), "Atelier Exemple");
  assert.equal(siteNameFromHost("www.mon_site.com"), "Mon Site");
  assert.equal(siteNameFromHost("blog.demenagements-leman.ch"), "Demenagements Leman");
  assert.equal(guessLanguage("x.ch"), "fr");
  assert.equal(guessLanguage("x.de"), "de");
  assert.equal(guessLanguage("x.it"), "it");
  assert.equal(guessLanguage("x.com"), "en");
});

test("slugify", () => {
  assert.equal(slugify("Déménager en hiver : 7 conseils !"), "demenager-en-hiver-7-conseils");
  assert.equal(slugify("Œuvre & Straße"), "oeuvre-strasse");
  assert.equal(slugify("!!!"), "article");
  const long = slugify("mot ".repeat(60));
  assert.ok(long.length <= 80 && !long.endsWith("-"));
  assert.equal(uniqueSlug("a", new Set(["a", "a-2"])), "a-3");
});

test("dates locales et jours de publication", () => {
  // 23 h 30 UTC le 31 décembre = 1er janvier à Zurich
  assert.equal(localDate(new Date("2026-12-31T23:30:00Z"), "Europe/Zurich"), "2027-01-01");
  assert.equal(addDays("2026-03-28", 2), "2026-03-30"); // changement d'heure : pas de décalage
  assert.equal(isoWeekday("2026-11-09"), 1); // lundi
  assert.equal(isoWeekday("2026-11-15"), 7); // dimanche
  const weekdays = publishDates("2026-11-09", 10, [1, 2, 3, 4, 5]);
  assert.equal(weekdays.length, 10);
  assert.ok(weekdays.every((d) => isoWeekday(d) <= 5));
  assert.equal(new Set(weekdays).size, 10);
  assert.equal(publishDates("2026-11-09", 3, []).length, 3); // aucun jour coché = tous les jours
  // 07:59 à Zurich (06:59 UTC en hiver) : pas encore l'heure de 08:00
  assert.equal(isDue("2026-11-09", "08:00", new Date("2026-11-09T06:59:00Z"), "Europe/Zurich"), false);
  assert.equal(isDue("2026-11-09", "08:00", new Date("2026-11-09T07:00:00Z"), "Europe/Zurich"), true);
  assert.equal(isDue("2026-11-08", "23:00", new Date("2026-11-09T00:00:00Z"), "Europe/Zurich"), true);
});

test("markdown : structure et sécurité", () => {
  const html = markdownToHtml("## Titre\n\nUn **gras** et *italique*.\n\n- a\n- b\n\n1. un\n2. deux\n\n> citation\n\n[lien](https://ex.ch) [interne](/page)");
  assert.match(html, /<h2>Titre<\/h2>/);
  assert.match(html, /<strong>gras<\/strong> et <em>italique<\/em>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<ol><li>un<\/li><li>deux<\/li><\/ol>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<a href="https:\/\/ex.ch" rel="noopener">lien<\/a>/);
  assert.match(html, /<a href="\/page">interne<\/a>/);
  const evil = markdownToHtml('<script>alert(1)</script>\n\n[x](javascript:alert(1)) [y](//evil.com) <img src=x onerror=alert(1)> [z](https://a.ch" onclick="x)');
  assert.doesNotMatch(evil, /<script|<img|href="javascript|href="\/\/|<[^>]*\son\w+=/);
  assert.match(evil, /&lt;script&gt;/);
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(escapeHtml(`<"'&>`), "&lt;&quot;&#39;&amp;&gt;");
  assert.equal(wordCount("## Bonjour le monde\n\n[l'été](/x) arrive."), 5);
});

test("calendrier démo : 30 sujets, dates distinctes, pas de doublon", () => {
  const topics = planDemoTopics("Déménagement", "2026-11-09", 30, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(topics.length, 30);
  assert.equal(new Set(topics.map((t) => t.scheduledFor)).size, 30);
  assert.equal(new Set(topics.map((t) => t.title)).size, 30);
  assert.equal(topics[0].title, "Déménagement : combien ça coûte en 2026 ?");
  assert.ok(topics.every((t) => !t.title.includes("{")));
  const alt = alternativeDemoTopic("déménagement", "2026-11-10", new Set(topics.map((t) => t.title)), 3);
  assert.ok(alt && !topics.some((t) => t.title === alt.title), "il reste des sujets de rechange après 30");
  const all45 = planDemoTopics("x", "2026-11-09", 45, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(alternativeDemoTopic("x", "2026-11-10", new Set(all45.map((t) => t.title)), 0), null);
  const alt2 = alternativeDemoTopic("déménagement", "2026-11-10", new Set([topics[0].title]), 0);
  assert.ok(alt2 && alt2.title !== topics[0].title && alt2.scheduledFor === "2026-11-10");
});

test("article démo : méta aux bonnes longueurs, liens internes ≤ 10", () => {
  const existing = Array.from({ length: 14 }, (_, i) => ({ title: `Article ${i}`, slug: `article-${i}` }));
  const a = writeDemoArticle({ siteName: "Atelier", siteUrl: "https://atelier.ch", theme: "déménagement", title: "Un titre ".repeat(10).trim(), angle: "Angle.", keyword: "kw", existing });
  assert.ok([...a.metaTitle].length <= 60);
  assert.ok([...a.metaDescription].length <= 155);
  assert.equal(a.internalLinks.length, 10);
  assert.ok(a.wordCount > 150);
  assert.match(markdownToHtml(a.bodyMd), /<a href="\/article-0">/);
  assert.equal(clip("abc", 5), "abc");
  assert.equal(clip("un deux trois quatre", 10), "un deux…");
});
