import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireAccount } from "@/lib/app/context";
import { finishGoogleConnect } from "@/lib/app/service";
import { siteOrigin } from "@/lib/config";
import { AccessDenied } from "@/lib/data/store";

const STATE_COOKIE = "altiseo_gsc_state";
const FLASH_COOKIE = "altiseo_gsc_message";
export const maxDuration = 60;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Retour de Google. Le message d'erreur éventuel passe par un cookie court, jamais par l'adresse. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = siteOrigin(url.origin);
  const { workspace } = await requireAccount();
  const done = (error?: string) => {
    const res = NextResponse.redirect(new URL("/app/mots-cles", origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/app/mots-cles" });
    if (error) res.cookies.set(FLASH_COOKIE, encodeURIComponent(error), { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/app/mots-cles", maxAge: 60 });
    else res.cookies.delete({ name: FLASH_COOKIE, path: "/app/mots-cles" });
    return res;
  };

  const [state, siteId] = (request.cookies.get(STATE_COOKIE)?.value ?? "").split(".");
  const back = url.searchParams.get("state") ?? "";
  if (!state || !siteId || !same(state, back)) return done("La connexion à Google a expiré. Recommencez.");
  if (url.searchParams.get("error")) return done("Vous n'avez pas donné l'accès à Google Search Console. Rien n'a été connecté.");
  const code = url.searchParams.get("code");
  if (!code) return done("Google n'a pas renvoyé d'accord. Recommencez.");

  try {
    const r = await finishGoogleConnect(workspace.id, siteId, code, `${origin}/app/mots-cles/google/callback`);
    revalidatePath("/app/mots-cles");
    return done(r.ok ? undefined : r.error);
  } catch (e) {
    if (!(e instanceof AccessDenied)) console.error("google.callback", e instanceof Error ? e.message : e);
    return done("La connexion à Google n'a pas abouti. Recommencez.");
  }
}
