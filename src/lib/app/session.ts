import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { userClient } from "@/lib/supabase/server";

/**
 * Session. Avec Supabase : Supabase Auth (lien de connexion par e-mail, cookies gérés par @supabase/ssr).
 * En MODE DÉMO : un cookie signé (HMAC-SHA256) avec l'identifiant du compte, sans mot de passe.
 */
const COOKIE = "altiseo_session";
const SITE_COOKIE = "altiseo_site";

function secret(): Buffer {
  const env = process.env.ALTISEO_SESSION_SECRET;
  if (env && env.length >= 32) return Buffer.from(env);
  if (process.env.NODE_ENV === "production" && !process.env.ALTISEO_DEMO) throw new Error("ALTISEO_SESSION_SECRET manquant (32 caractères au moins)");
  // Développement : secret local gardé dans .data/ pour survivre aux redémarrages.
  const file = path.join(process.cwd(), ".data", "session-secret");
  try {
    return readFileSync(file);
  } catch {
    const s = randomBytes(32);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, s, { mode: 0o600 });
    return s;
  }
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function encodeSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function decodeSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const id = raw.slice(0, i);
  const got = Buffer.from(raw.slice(i + 1));
  const want = Buffer.from(sign(id));
  return got.length === want.length && timingSafeEqual(got, want) ? id : null;
}

export async function sessionUserId(): Promise<string | null> {
  if (config.supabase) {
    const { data } = await (await userClient()).auth.getUser();
    return data.user?.id ?? null;
  }
  return decodeSession((await cookies()).get(COOKIE)?.value);
}

export async function startSession(userId: string) {
  (await cookies()).set(COOKIE, encodeSession(userId), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  if (config.supabase) await (await userClient()).auth.signOut();
  const c = await cookies();
  c.delete(COOKIE);
  c.delete(SITE_COOKIE);
}

export async function currentSiteId(): Promise<string | null> {
  return (await cookies()).get(SITE_COOKIE)?.value ?? null;
}

export async function rememberSite(siteId: string) {
  (await cookies()).set(SITE_COOKIE, siteId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
}
