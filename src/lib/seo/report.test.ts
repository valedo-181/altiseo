import { test } from "node:test";
import assert from "node:assert/strict";
import { ISSUE_CODES, scoreSite, type PageFacts } from "./audit.ts";
import { ISSUE_TEXT, issueScope, issueText, toAuditIssues } from "./report.ts";

const page = (over: Partial<PageFacts>): PageFacts => ({
  url: "https://ex.ch/", status: 200, ms: 100, title: "Déménagement à Lausanne : devis gratuit", description: "Entreprise de déménagement à Lausanne, devis gratuit sous 24 heures, équipe expérimentée.",
  h1: ["Déménagement"], noindex: false, canonical: null, lang: "fr", viewport: true, images: 4, imagesNoAlt: 0, words: 600,
  ldTypes: ["Organization"], text: "", links: [], ...over,
});

test("un site propre obtient 100 et aucun problème", () => {
  const r = scoreSite({ home: "https://ex.ch/", pages: [page({}), page({ url: "https://ex.ch/a", title: "Garde-meubles à Lausanne : nos boxes" })], broken: [], sitemap: true, speed: { score: 95, lcp_ms: 1500, cls: 0, inp_ms: null, fcp_ms: null } }, { name: "Ex", phone: null, address: null });
  assert.equal(r.score, 100);
  assert.deepEqual(toAuditIssues(r.issues), []);
});

test("problèmes classés par gravité, sans les contrôles réussis ni ceux sans donnée", () => {
  const r = scoreSite({
    home: "http://ex.ch/",
    pages: [page({ url: "http://ex.ch/", title: null, ldTypes: [], imagesNoAlt: 3 }), page({ url: "http://ex.ch/b", description: null, words: 80, ldTypes: [] })],
    broken: [{ url: "http://ex.ch/x", status: 404 }], sitemap: false, speed: null,
  }, { name: "Ex", phone: null, address: null });
  const issues = toAuditIssues(r.issues);
  const codes = issues.map((i) => i.code);
  assert.ok(r.score < 70);
  assert.deepEqual([...new Set(issues.map((i) => i.level))], ["critical", "warning", "info"]); // ordre de gravité
  for (const c of ["https", "title", "broken", "description", "local_business", "img_alt", "sitemap", "thin"]) assert.ok(codes.includes(c), c);
  for (const c of ["speed", "phone", "address", "viewport"]) assert.ok(!codes.includes(c), c); // pas de donnée ou réussi
  const title = issues.find((i) => i.code === "title")!;
  assert.equal(issueScope(title), "1 page sur 2");
  assert.equal(issueScope(issues.find((i) => i.code === "img_alt")!), "3 images sur 8");
  assert.deepEqual(title.pages, ["http://ex.ch/"]);
});

test("chaque contrôle a un libellé, une raison et une correction", () => {
  for (const c of ISSUE_CODES) {
    const t = ISSUE_TEXT[c];
    assert.ok(t.title.length > 5 && t.why.length > 20 && t.fix.length > 20, c);
  }
  assert.equal(issueText("inconnu").title, "inconnu");
  assert.equal(issueScope({ code: "speed", level: "critical", affected: 0, total: 0, pages: [], detail: "41" }), "note 41 sur 100");
});
