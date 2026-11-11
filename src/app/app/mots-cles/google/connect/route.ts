import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireSite } from "@/lib/app/context";
import { config, siteOrigin } from "@/lib/config";
import { consentUrl } from "@/lib/search/google";

const STATE_COOKIE = "altiseo_gsc_state";

/**
 * Départ vers l'écran d'accord de Google (lecture seule de Search Console). Un secret à usage unique
 * est posé dans un cookie et renvoyé par Google : le retour n'est accepté que s'ils concordent.
 */
export async function GET(request: NextRequest) {
  const { site } = await requireSite();
  const origin = siteOrigin(new URL(request.url).origin);
  if (!config.search) return NextResponse.redirect(new URL("/app/mots-cles", origin));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(consentUrl(process.env.GOOGLE_CLIENT_ID!.trim(), `${origin}/app/mots-cles/google/callback`, state));
  res.cookies.set(STATE_COOKIE, `${state}.${site.id}`, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/app/mots-cles", maxAge: 600 });
  return res;
}
