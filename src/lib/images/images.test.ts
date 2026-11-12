import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, imageAlt, isLegacyImagePrompt, isOwnImage, IMAGE_STYLE } from "./prompt.ts";
import { findImageUrl, generateImage, higgsfieldKey } from "./higgsfield.ts";

test("la demande d'image impose la photo réaliste, sans texte ni visage", () => {
  const p = buildImagePrompt({ idea: "Stacked moving boxes in a bright empty living room.", title: "T", theme: "déménagement" });
  assert.ok(p.startsWith("Stacked moving boxes in a bright empty living room. Realistic editorial photograph"));
  assert.ok(p.endsWith(IMAGE_STYLE));
  const q = buildImagePrompt({ title: "Garde-meubles : <b>quelle</b> taille ?", theme: "déménagement", keyword: "garde-meubles" });
  assert.ok(q.startsWith("A realistic everyday scene about garde-meubles, déménagement, shown only through concrete objects"), q);
  assert.ok(!q.includes("Garde-meubles :") && !q.includes("taille"), "le titre ne doit jamais entrer dans la demande");
  assert.ok(!/["«»“”]/.test(buildImagePrompt({ idea: 'A box labelled "Fragile" on a parquet floor.', title: "T", theme: "" })), "pas de guillemets");
  assert.ok(buildImagePrompt({ title: "T", theme: "" }).startsWith("A realistic everyday scene about home life"));
  assert.ok(isLegacyImagePrompt('A scene illustrating "État des lieux", in the field of x.'));
  assert.ok(!isLegacyImagePrompt(p) && !isLegacyImagePrompt(null));
  assert.equal(imageAlt("  Déménager\nen hiver  "), "Déménager en hiver");
});

test("seules les images de notre stockage partent vers le site du client", () => {
  const base = "https://abc.supabase.co";
  assert.ok(isOwnImage("https://abc.supabase.co/storage/v1/object/public/article-images/w/a.jpg", base));
  assert.ok(!isOwnImage("https://evil.example/storage/v1/object/public/article-images/w/a.jpg", base));
  assert.ok(!isOwnImage("https://abc.supabase.co/storage/v1/object/public/autre/a.jpg", base));
  assert.ok(!isOwnImage("http://abc.supabase.co/storage/v1/object/public/article-images/a.jpg", base));
  assert.ok(!isOwnImage("/brand/sommet.jpg", base));
  assert.ok(!isOwnImage(null, base));
});

test("lecture tolérante de la réponse", () => {
  assert.equal(findImageUrl({ status_url: "https://api.higgsfield.ai/requests/1/status", images: [{ url: "https://cdn.test/a.png" }] }), "https://cdn.test/a.png");
  assert.equal(findImageUrl({ result: { image: { url: "https://cdn.test/x?sig=1" } }, cancel_url: "https://api.higgsfield.ai/c" }), "https://cdn.test/x?sig=1");
  assert.equal(findImageUrl({ status: "queued", status_url: "https://api.higgsfield.ai/s" }), null);
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const key = { keyId: "id", keySecret: "tres-secret", pollMs: 1 };

test("dépôt, suivi puis téléchargement de l'image", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let polls = 0;
  const r = await generateImage("a photo", { ...key, fetcher: async (url, init) => {
    calls.push({ url, init });
    if (url === "https://api.higgsfield.ai/z-image/turbo") return json(200, { request_id: "req_123456", status: "queued", status_url: "https://api.higgsfield.ai/requests/req_123456/status" });
    if (url.endsWith("/status")) return json(200, ++polls < 2 ? { status: "in_progress" } : { status: "completed", images: [{ url: "https://cdn.test/out.png" }] });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } });
  } });
  assert.ok(r.ok && r.contentType === "image/png" && r.bytes.length === 3);
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Key id:tres-secret");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { prompt: "a photo", aspect_ratio: "16:9", resolution: "1k" });
  assert.equal((calls.at(-1)!.init.headers as Record<string, string> | undefined)?.Authorization, undefined, "la clé ne part pas vers le serveur de fichiers");
});

test("refus, filtre de contenu, fichier qui n'est pas une image : erreurs lisibles, sans la clé", async () => {
  const bad = await generateImage("p", { ...key, fetcher: async () => json(401, { error: "tres-secret" }) });
  assert.ok(!bad.ok && !bad.error.includes("tres-secret"));
  const nsfw = await generateImage("p", { ...key, fetcher: async () => json(200, { request_id: "req_123456", status: "nsfw" }) });
  assert.ok(!nsfw.ok && /filtre/.test(nsfw.error));
  const html = await generateImage("p", { ...key, fetcher: async (url) => (url.includes("api.higgsfield.ai") ? json(200, { status: "completed", images: [{ url: "https://cdn.test/a.png" }] }) : new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })) });
  assert.ok(!html.ok && /pas une image/.test(html.error));
  const internal = await generateImage("p", { ...key, isPublic: async () => false, fetcher: async () => json(200, { status: "completed", images: [{ url: "https://169.254.169.254/a.png" }] }) });
  assert.ok(!internal.ok);
  const foreign = await generateImage("p", { ...key, fetcher: async (url) => (url.endsWith("turbo") ? json(200, { request_id: "../../x", status: "queued", status_url: "https://evil.example/s" }) : json(500, {})) });
  assert.ok(!foreign.ok && /suivi/.test(foreign.error), "un lien de suivi hors de Higgsfield n'est pas suivi");
  const model = await generateImage("p", { ...key, model: "https://evil.example", fetcher: async () => json(200, {}) });
  assert.ok(!model.ok);
});

test("clé Higgsfield : guillemets et espaces tolérés, clé entière dans une seule variable, caractères interdits refusés", async () => {
  assert.equal(higgsfieldKey(" abc123 ", '"s3cr3t-xyz"\n'), "abc123:s3cr3t-xyz");
  assert.equal(higgsfieldKey("abc123:s3cr3t-xyz", ""), "abc123:s3cr3t-xyz");
  assert.equal(higgsfieldKey("", "abc123:s3cr3t-xyz"), "abc123:s3cr3t-xyz");
  assert.equal(higgsfieldKey("abc 123", "s3cr3t-xyz"), null);
  assert.equal(higgsfieldKey("abc123", "secrét-xyz"), null);
  assert.equal(higgsfieldKey("hf_abc123456", ""), "hf_abc123456", "clé d'un seul tenant acceptée telle quelle");
  assert.equal(higgsfieldKey("abc", ""), null);
  let called = false;
  const r = await generateImage("p", { keyId: "abc 123", keySecret: "x", fetcher: async () => { called = true; return json(200, {}); } });
  assert.ok(!r.ok && /bonne forme/.test(r.error) && !called);
});

test("pannes : la raison est dite (délai, réseau, modèle inconnu, paramètre refusé), jamais la clé", async () => {
  const timeout = await generateImage("p", { ...key, fetcher: async () => { throw Object.assign(new Error("x"), { name: "TimeoutError" }); } });
  assert.ok(!timeout.ok && /délai dépassé/.test(timeout.error));
  const dns = await generateImage("p", { ...key, fetcher: async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); } });
  assert.ok(!dns.ok && /ENOTFOUND/.test(dns.error));
  const model = await generateImage("p", { ...key, model: "inconnu/modele", fetcher: async () => json(404, { detail: "Not Found" }) });
  assert.ok(!model.ok && /inconnu\/modele/.test(model.error));
  const credits = await generateImage("p", { ...key, fetcher: async () => json(403, { detail: "not_enough_credits" }) });
  assert.ok(!credits.ok && /solde/.test(credits.error));
  const param = await generateImage("p", { ...key, fetcher: async () => json(422, { detail: [{ loc: ["body", "resolution"], msg: "id:tres-secret invalid" }] }) });
  assert.ok(!param.ok && /422/.test(param.error) && /resolution/.test(param.error) && !param.error.includes("tres-secret"));
});
