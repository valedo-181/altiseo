import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSupabaseUrl } from "./url.ts";

test("adresse Supabase : origine seule, même si l'adresse Data API est collée", () => {
  assert.equal(cleanSupabaseUrl("https://abc.supabase.co/rest/v1/"), "https://abc.supabase.co");
  assert.equal(cleanSupabaseUrl("  https://abc.supabase.co/ "), "https://abc.supabase.co");
  assert.equal(cleanSupabaseUrl("https://abc.supabase.co"), "https://abc.supabase.co");
  assert.equal(cleanSupabaseUrl(undefined), undefined);
});
