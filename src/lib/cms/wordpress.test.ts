import { test } from "node:test";
import assert from "node:assert/strict";
import { testWordPress, uploadWordPressMedia, upsertWordPressPost } from "./wordpress.ts";

const creds = { endpoint: "https://8.8.8.8", username: "alice", appPassword: "abcd efgh ijkl mnop qrst uvwx" };
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("adresse interne refusée sans appel réseau", async () => {
  let called = false;
  const r = await testWordPress({ ...creds, endpoint: "http://127.0.0.1" }, async () => { called = true; return res(200, {}); });
  assert.equal(r.ok, false);
  assert.equal(called, false);
});

test("test de connexion : authentification Basic sans espaces, pas de redirection suivie, erreurs expliquées", async () => {
  const seen: any[] = [];
  const ok = await testWordPress(creds, async (url, init) => { seen.push({ url, init }); return res(200, { name: "Alice", capabilities: { edit_posts: true } }); });
  assert.deepEqual(ok, { ok: true, value: { name: "Alice" } });
  assert.equal(seen[0].url, "https://8.8.8.8/wp-json/wp/v2/users/me?context=edit");
  assert.equal(seen[0].init.redirect, "manual");
  assert.equal(Buffer.from(seen[0].init.headers.Authorization.split(" ")[1], "base64").toString(), "alice:abcdefghijklmnopqrstuvwx");
  const bad = await testWordPress(creds, async () => res(401, { code: "incorrect_password" }));
  assert.ok(!bad.ok && /mot de passe d'application/.test(bad.error) && !bad.error.includes("abcd"));
  const noRight = await testWordPress(creds, async () => res(200, { name: "A", capabilities: { read: true } }));
  assert.ok(!noRight.ok);
});

test("repli sur ?rest_route= quand /wp-json est introuvable", async () => {
  const urls: string[] = [];
  const r = await testWordPress(creds, async (url) => { urls.push(url); return url.includes("/wp-json/") ? res(404, {}) : res(200, { name: "A" }); });
  assert.ok(r.ok);
  assert.equal(urls[1], "https://8.8.8.8/?rest_route=%2Fwp%2Fv2%2Fusers%2Fme&context=edit");
});

test("publication : création, puis mise à jour du même billet ; billet supprimé recréé", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const f = async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    if (url.endsWith("/posts/42")) return res(404, { code: "rest_post_invalid_id" });
    return res(201, { id: 77, link: "https://8.8.8.8/mon-article/" });
  };
  const created = await upsertWordPressPost(creds, { title: "T", html: "<p>x</p>", slug: "t", excerpt: "e", status: "draft" }, null, f);
  assert.deepEqual(created, { ok: true, value: { id: "77", url: "https://8.8.8.8/wp-admin/post.php?post=77&action=edit" } });
  assert.equal(calls[0].body.status, "draft");
  const again = await upsertWordPressPost(creds, { title: "T", html: "<p>x</p>", slug: "t", excerpt: "e", status: "publish" }, "42", f);
  assert.ok(again.ok && again.value.url === "https://8.8.8.8/mon-article/");
  assert.match(calls[1].url, /\/posts\/42$/);
  assert.match(calls[2].url, /\/posts$/);
});

test("image mise en avant : dépôt dans la médiathèque, texte de remplacement, puis rattachement au billet", async () => {
  const seen: any[] = [];
  const up = await uploadWordPressMedia(creds, { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg", filename: "Déménager en hiver !.jpg", alt: "Déménager en hiver" }, async (url, init) => {
    seen.push({ url, init });
    return res(url.endsWith("/media") ? 201 : 200, { id: 77 });
  });
  assert.deepEqual(up, { ok: true, value: { id: 77 } });
  assert.equal(seen[0].url, "https://8.8.8.8/wp-json/wp/v2/media");
  assert.equal(seen[0].init.headers["Content-Type"], "image/jpeg");
  assert.equal(seen[0].init.headers["Content-Disposition"], 'attachment; filename="d-m-nager-en-hiver-.jpg"');
  assert.ok(seen[0].init.body instanceof Uint8Array);
  assert.equal(seen[1].url, "https://8.8.8.8/wp-json/wp/v2/media/77");
  assert.deepEqual(JSON.parse(seen[1].init.body), { alt_text: "Déménager en hiver" });

  const bodies: any[] = [];
  const post = { title: "T", html: "<p>x</p>", slug: "t", excerpt: "e", status: "draft" as const };
  await upsertWordPressPost(creds, { ...post, featuredMedia: 77 }, null, async (_u, init) => { bodies.push(JSON.parse(String(init.body))); return res(201, { id: 5 }); });
  await upsertWordPressPost(creds, post, "5", async (_u, init) => { bodies.push(JSON.parse(String(init.body))); return res(200, { id: 5 }); });
  assert.equal(bodies[0].featured_media, 77);
  assert.ok(!("featured_media" in bodies[1]), "sans image précisée, on ne touche pas à celle du billet");

  const denied = await uploadWordPressMedia(creds, { bytes: new Uint8Array([1]), contentType: "image/png", filename: "a.png", alt: "" }, async () => res(403, { code: "rest_cannot_create" }));
  assert.ok(!denied.ok && /images/.test(denied.error));
});
