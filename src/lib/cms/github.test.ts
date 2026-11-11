import { test } from "node:test";
import assert from "node:assert/strict";
import { articleJson, isDir, isRepo, looksLikeGitHubToken, testGitHub, upsertGitHubArticle, type GhArticle } from "./github.ts";

const TOKEN = "github_pat_" + "A".repeat(60);
const creds = { repo: "valedo-181/domevia", branch: "main", dir: "blog", token: TOKEN };
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const article = (o: Partial<GhArticle> = {}): GhArticle => ({
  slug: "preparer-demenagement", title: "Préparer son déménagement", metaTitle: "Préparer son déménagement", description: "Résumé.",
  date: "2026-11-11T08:00:00.000Z", updated: null, keyword: "déménagement", html: "<p>Texte</p>", draft: false, image: null, keepImage: null, ...o,
});

/** Faux GitHub : garde les fichiers en mémoire et note chaque appel. */
function fakeGitHub(files: Record<string, string> = {}) {
  const calls: Array<{ method: string; url: string; body: any; auth: string }> = [];
  const f = async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method: String(init.method), url, body, auth: (init.headers as Record<string, string>).Authorization });
    assert.ok(url.startsWith("https://api.github.com/"));
    assert.equal(init.redirect, "error");
    const m = url.match(/\/contents\/([^?]+)/);
    const path = m ? decodeURIComponent(m[1]) : "";
    if (init.method === "GET") return path in files ? res(200, { sha: `sha-${path}` }) : res(404, { message: "Not Found" });
    if (init.method === "PUT") { files[path] = Buffer.from(body.content, "base64").toString(); return res(201, { content: { path } }); }
    if (init.method === "DELETE") { delete files[path]; return res(200, {}); }
    return res(500, {});
  };
  return { f, calls, files };
}

test("formes acceptées : dépôt, dossier, jeton", () => {
  assert.ok(isRepo("valedo-181/domevia"));
  assert.ok(!isRepo("valedo-181/../x") && !isRepo("https://github.com/a/b") && !isRepo("a"));
  assert.ok(isDir("blog") && isDir("fr/blog") && !isDir("../blog") && !isDir("/blog") && !isDir("Blog"));
  assert.ok(looksLikeGitHubToken(TOKEN) && looksLikeGitHubToken("ghp_" + "a".repeat(36)) && !looksLikeGitHubToken("motdepasse"));
});

test("test de connexion : droit d'écriture et branche vérifiés, jeton absent des erreurs", async () => {
  const ok = await testGitHub(creds, async (url) => (url.endsWith("/branches/main") ? res(200, {}) : res(200, { full_name: "valedo-181/domevia", permissions: { push: true } })));
  assert.deepEqual(ok, { ok: true, value: { repo: "valedo-181/domevia", branch: "main" } });
  const readOnly = await testGitHub(creds, async () => res(200, { permissions: { push: false } }));
  assert.ok(!readOnly.ok && /Read and write/.test(readOnly.error));
  const bad = await testGitHub(creds, async () => res(401, { message: "Bad credentials" }));
  assert.ok(!bad.ok && !bad.error.includes(TOKEN));
  const noBranch = await testGitHub(creds, async (url) => (url.includes("/branches/") ? res(404, {}) : res(200, { permissions: { push: true } })));
  assert.ok(!noBranch.ok && /branche « main »/.test(noBranch.error));
});

test("publication : JSON écrit dans blog/articles, adresse publique, jeton en Bearer", async () => {
  const gh = fakeGitHub();
  const r = await upsertGitHubArticle(creds, "https://domevia.ch", article(), null, null, gh.f);
  assert.deepEqual(r, { ok: true, value: { id: "blog/articles/preparer-demenagement.json", url: "https://domevia.ch/blog/preparer-demenagement.html", image: null, imageMissing: false } });
  const doc = JSON.parse(gh.files["blog/articles/preparer-demenagement.json"]);
  assert.equal(doc.title, "Préparer son déménagement");
  assert.equal(doc.html, "<p>Texte</p>");
  assert.equal(doc.draft, undefined);
  const put = gh.calls.find((c) => c.method === "PUT")!;
  assert.equal(put.auth, `Bearer ${TOKEN}`);
  assert.equal(put.body.branch, "main");
  assert.equal(put.body.sha, undefined); // nouveau fichier
});

test("mise à jour : sha envoyé ; slug changé → ancien fichier retiré ; brouillon → lien GitHub", async () => {
  const gh = fakeGitHub({ "blog/articles/ancien.json": "{}" });
  const r = await upsertGitHubArticle(creds, "https://domevia.ch", article({ draft: true }), "blog/articles/ancien.json", null, gh.f);
  assert.ok(r.ok);
  assert.equal(r.value.url, "https://github.com/valedo-181/domevia/blob/main/blog/articles/preparer-demenagement.json");
  assert.ok(!("blog/articles/ancien.json" in gh.files));
  assert.equal(JSON.parse(gh.files["blog/articles/preparer-demenagement.json"]).draft, true);
  const again = await upsertGitHubArticle(creds, "https://domevia.ch", article(), "blog/articles/preparer-demenagement.json", null, gh.f);
  assert.ok(again.ok);
  assert.equal(gh.calls.filter((c) => c.method === "PUT").at(-1)!.body.sha, "sha-blog/articles/preparer-demenagement.json");
});

test("image : envoyée dans blog/img, gardée sans renvoi, retirée quand l'article n'en a plus", async () => {
  const gh = fakeGitHub();
  const img = { bytes: new Uint8Array([1, 2, 3]), ext: "jpg" as const, alt: "Un carton" };
  const r = await upsertGitHubArticle(creds, "https://domevia.ch", article({ image: img }), null, null, gh.f);
  assert.ok(r.ok && r.value.image === "blog/img/preparer-demenagement.jpg");
  assert.equal(JSON.parse(gh.files["blog/articles/preparer-demenagement.json"]).image, "img/preparer-demenagement.jpg");
  const puts = gh.calls.filter((c) => c.method === "PUT").length;
  const kept = await upsertGitHubArticle(creds, "https://domevia.ch", article({ keepImage: "blog/img/preparer-demenagement.jpg" }), r.value.id, r.value.image, gh.f);
  assert.ok(kept.ok && kept.value.image === "blog/img/preparer-demenagement.jpg");
  assert.equal(gh.calls.filter((c) => c.method === "PUT").length, puts + 1); // seulement le JSON
  const none = await upsertGitHubArticle(creds, "https://domevia.ch", article(), r.value.id, r.value.image, gh.f);
  assert.ok(none.ok && none.value.image === null);
  assert.ok(!("blog/img/preparer-demenagement.jpg" in gh.files));
});

test("erreur GitHub expliquée, rien d'autre n'est tenté", async () => {
  const r = await upsertGitHubArticle(creds, "https://domevia.ch", article(), null, null, async () => res(403, { message: "Resource not accessible" }));
  assert.ok(!r.ok && /Contents/.test(r.error));
  const slug = await upsertGitHubArticle(creds, "https://domevia.ch", article({ slug: "../x" }), null, null, async () => { throw new Error("pas d'appel"); });
  assert.ok(!slug.ok);
});

test("le JSON ne contient que les champs utiles", () => {
  const doc = JSON.parse(articleJson(article({ metaTitle: "Titre SEO", updated: "2026-11-12T00:00:00.000Z" }), null));
  assert.deepEqual(Object.keys(doc), ["slug", "title", "metaTitle", "description", "date", "updated", "keyword", "html", "source"]);
});
