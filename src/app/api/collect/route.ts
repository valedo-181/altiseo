import type { NextRequest } from "next/server";
import { recordHit } from "@/lib/app/stats";
import { runAsSystem } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Page vue envoyée par /s.js depuis le site d'un client (texte brut, sans cookie, sans préflight).
 * Répond toujours 204 : le site du client ne doit jamais voir d'erreur ni attendre.
 */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" };
const done = () => new Response(null, { status: 204, headers: CORS });

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const h = request.headers;
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "0.0.0.0";
    await runAsSystem(() => recordHit({ body, ip, ua: h.get("user-agent") ?? "", country: h.get("x-vercel-ip-country") }));
  } catch (e) {
    console.error("stats.collect", e instanceof Error ? e.message : e);
  }
  return done();
}

export function OPTIONS() {
  return done();
}
