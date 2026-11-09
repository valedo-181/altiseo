import { test } from "node:test";
import assert from "node:assert/strict";
import { testWordPress, upsertWordPressPost } from "./wordpress.ts";

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
