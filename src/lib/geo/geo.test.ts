import { test } from "node:test";
import assert from "node:assert/strict";
import { adviceFor, analyzeAnswer, blockedAiBots, hostOf, jsonLdTypes, readiness, sampleAnswer, suggestQuestions, topCompetitors, visibilityScore, weekOf, type CheckLite } from "./analyze.ts";
import { askChatGpt, askClaude, askGemini, askPerplexity, countryOf, engineKeys, type Fetcher } from "./engines.ts";

const SITE = { name: "Domevia", domain: "domevia.ch" };
const RIVALS = [{ name: "Déménagements Rapides", domain: "demenagements-rapides.ch" }, { name: "Alpha Transports", domain: "alpha-transports.ch" }];

test("le site cité en deuxième place, après un concurrent, et présent dans les sources", () => {
  const r = analyzeAnswer({
    text: "Pour Neuchâtel : 1. Alpha Transports, très connu. 2. Domevia (domevia.ch), prix clairs. 3. Autre.",
    sources: ["https://www.domevia.ch/demenagement", "https://alpha-transports.ch/", "pas une adresse"],
  }, SITE, RIVALS);
  assert.equal(r.cited, true);
  assert.equal(r.position, 2);
  assert.equal(r.linked, true);
  assert.deepEqual(r.competitors.map((c) => c.domain), ["alpha-transports.ch"]);
  assert.equal(r.sources.length, 2);
});

test("accents et majuscules ignorés ; un mot qui contient le nom ne compte pas", () => {
  const r = analyzeAnswer({ text: "Je conseille DEMENAGEMENTS RAPIDES. Les domeviables n'existent pas.", sources: [] }, SITE, RIVALS);
  assert.equal(r.cited, false);
  assert.equal(r.position, null);
  assert.deepEqual(r.competitors.map((c) => c.name), ["Déménagements Rapides"]);
});

test("le site seulement dans les sources : visible mais pas nommé", () => {
  const r = analyzeAnswer({ text: "Comptez 1500 à 2500 CHF.", sources: ["https://blog.domevia.ch/prix"] }, SITE, []);
  assert.equal(r.cited, false);
  assert.equal(r.linked, true);
  assert.deepEqual(visibilityScore([{ questionId: "q", engine: "chatgpt", status: "ok", cited: false, linked: true, position: null, competitors: [] }]), { score: 100, seen: 1, total: 1 });
});

test("note : les erreurs ne comptent pas ; concurrents classés par nombre de citations", () => {
  const c = (o: Partial<CheckLite>): CheckLite => ({ questionId: "q1", engine: "chatgpt", status: "ok", cited: false, linked: false, position: null, competitors: [], ...o });
  const checks = [c({ cited: true, competitors: [RIVALS[0]] }), c({ competitors: [RIVALS[0], RIVALS[1]] }), c({ status: "error" }), c({ competitors: [RIVALS[1], RIVALS[1]] })];
  assert.deepEqual(visibilityScore(checks), { score: 33, seen: 1, total: 3 });
  assert.equal(visibilityScore([]).score, null);
  const top = topCompetitors(checks);
  assert.deepEqual(top.map((t) => [t.domain, t.count]), [["alpha-transports.ch", 2], ["demenagements-rapides.ch", 2]]);
});

test("semaine : toujours le lundi", () => {
  assert.equal(weekOf("2026-11-12"), "2026-11-09"); // jeudi
  assert.equal(weekOf("2026-11-09"), "2026-11-09"); // lundi
  assert.equal(weekOf("2026-11-15"), "2026-11-09"); // dimanche
  assert.equal(hostOf("https://WWW.Exemple.ch/x"), "exemple.ch");
  assert.equal(hostOf("::"), null);
});

test("robots.txt : robots des IA bloqués, groupes et Allow pris en compte", () => {
  const robots = "User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /prive\n\nUser-agent: *\nDisallow: /admin\n";
  assert.deepEqual(blockedAiBots(robots), ["GPTBot", "PerplexityBot"]);
  assert.deepEqual(blockedAiBots("User-agent: *\nDisallow: /\n"), ["OAI-SearchBot", "ChatGPT-User", "GPTBot", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended"]);
  assert.deepEqual(blockedAiBots("User-agent: *\nDisallow: /\nUser-agent: OAI-SearchBot\nAllow: /\n").includes("OAI-SearchBot"), false);
});

test("préparation : FAQ et entreprise lues dans le JSON-LD, même dans @graph", () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"MovingCompany","name":"Domevia"},{"@type":"FAQPage"}]}</script><script type="application/ld+json">{oups</script>`;
  assert.deepEqual(jsonLdTypes(html).sort(), ["FAQPage", "MovingCompany"]);
  assert.deepEqual(readiness({ robots: null, llmsTxt: false, homeHtml: html }), { blockedBots: [], llmsTxt: false, faq: true, organization: true });
});

test("conseils : robots d'abord, puis un article par question jamais citée", () => {
  const qs = [{ id: "a", question: "Prix d'un déménagement ?" }, { id: "b", question: "Meilleur déménageur ?" }];
  const checks: CheckLite[] = [
    { questionId: "a", engine: "chatgpt", status: "ok", cited: false, linked: false, position: null, competitors: [] },
    { questionId: "b", engine: "chatgpt", status: "ok", cited: true, linked: false, position: 1, competitors: [] },
  ];
  const adv = adviceFor(qs, checks, { blockedBots: ["GPTBot"], llmsTxt: true, faq: false, organization: true });
  assert.deepEqual(adv.map((a) => a.kind), ["robots", "article", "faq"]);
  assert.equal(adv[1].question, "Prix d'un déménagement ?");
});

test("questions proposées : sujet puis mots-clés, sans doublon ni question déjà suivie", () => {
  const q = suggestQuestions({ theme: "déménagement", keywords: ["déménagement Neuchâtel", "déménagement Neuchâtel", "garde-meubles"], language: "fr", existing: ["Quelle entreprise me conseilles-tu pour « garde-meubles » ?"] }, 4);
  assert.deepEqual(q, ["Quelle est la meilleure entreprise de déménagement ?", "Quelle entreprise me conseilles-tu pour « déménagement Neuchâtel » ?", "Que dois-je savoir sur « déménagement Neuchâtel » ?", "Que dois-je savoir sur « garde-meubles » ?"]);
  assert.equal(suggestQuestions({ theme: "", keywords: [], language: "de", existing: [] }).length, 0);
});

test("réponses d'exemple : identiques d'une fois à l'autre, lisibles par l'analyse", () => {
  const a = sampleAnswer("Meilleur déménageur ?", "chatgpt", SITE, RIVALS, "2026-11-09");
  assert.deepEqual(a, sampleAnswer("Meilleur déménageur ?", "chatgpt", SITE, RIVALS, "2026-11-09"));
  const r = analyzeAnswer(a, SITE, RIVALS);
  assert.ok(r.competitors.length >= 1);
});

// ---------------------------------------------------------------------------
// Appels aux IA (faux réseau)
// ---------------------------------------------------------------------------

function fake(status: number, json: unknown, seen: Array<{ url: string; init: RequestInit }> = []): Fetcher {
  return async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } }); };
}

test("ChatGPT : texte et sources lus dans la réponse, pays transmis, clé dans l'en-tête", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const r = await askChatGpt(fake(200, { output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "Domevia est bien noté.", annotations: [{ type: "url_citation", url: "https://domevia.ch/" }] }] }] }, seen), "sk-test", "Meilleur déménageur ?", "CH");
  assert.deepEqual(r, { ok: true, value: { text: "Domevia est bien noté.", sources: ["https://domevia.ch/"] } });
  const body = JSON.parse(String(seen[0].init.body));
  assert.equal(body.tools[0].type, "web_search");
  assert.equal(body.tools[0].user_location.country, "CH");
  assert.equal((seen[0].init.headers as Record<string, string>).authorization, "Bearer sk-test");
});

test("Gemini : le domaine du titre remplace l'adresse de redirection de Google", async () => {
  const r = await askGemini(fake(200, { candidates: [{ content: { parts: [{ text: "Voici " }, { text: "la liste." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/redirect/x", title: "domevia.ch" } }, { web: { uri: "https://exemple.ch/a", title: "Un titre" } }] } }] }), "k", "Q ?");
  assert.deepEqual(r, { ok: true, value: { text: "Voici la liste.", sources: ["https://domevia.ch/", "https://exemple.ch/a"] } });
});

test("Perplexity et Claude : sources des résultats et des citations", async () => {
  const p = await askPerplexity(fake(200, { choices: [{ message: { content: "Réponse." } }], citations: ["https://a.ch/"], search_results: [{ url: "https://b.ch/" }] }), "k", "Q ?", null);
  assert.deepEqual(p, { ok: true, value: { text: "Réponse.", sources: ["https://b.ch/"] } });
  const c = await askClaude(fake(200, { content: [{ type: "server_tool_use" }, { type: "web_search_tool_result", content: [{ url: "https://c.ch/" }] }, { type: "text", text: "Selon c.ch…", citations: [{ url: "https://c.ch/page" }] }] }), "k", "Q ?", "CH");
  assert.deepEqual(c, { ok: true, value: { text: "Selon c.ch…", sources: ["https://c.ch/page", "https://c.ch/"] } });
});

test("erreurs lisibles, sans la clé : clé refusée, crédit épuisé, réseau coupé, réponse vide", async () => {
  assert.deepEqual(await askChatGpt(fake(401, { error: { message: "bad key sk-secret" } }), "sk-secret", "Q", null), { ok: false, error: "Clé API ChatGPT refusée." });
  assert.deepEqual(await askPerplexity(fake(429, {}), "k", "Q", null), { ok: false, error: "Perplexity est très demandé ou le crédit est épuisé (429)." });
  const down: Fetcher = async () => { throw new TypeError("fetch failed"); };
  assert.deepEqual(await askGemini(down, "k", "Q"), { ok: false, error: "Gemini ne répond pas." });
  assert.deepEqual(await askClaude(fake(200, { content: [] }), "k", "Q", null), { ok: false, error: "Claude n'a pas donné de réponse." });
});

test("clés et pays", () => {
  assert.deepEqual(engineKeys({ OPENAI_API_KEY: " sk ", GEMINI_API_KEY: "", ANTHROPIC_API_KEY: "a" }), { chatgpt: "sk", gemini: undefined, perplexity: undefined, claude: "a" });
  assert.equal(countryOf("domevia.ch"), "CH");
  assert.equal(countryOf("exemple.com"), null);
});
