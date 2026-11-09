import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

/**
 * Retour du lien de connexion (Supabase Auth, flux PKCE) : ouvre la session, crée l'espace au premier
 * passage (ensure_workspace), puis envoie vers l'application. À déclarer dans Supabase :
 * Authentication → URL Configuration → Redirect URLs : <adresse>/auth/callback
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  if (!code) return back("/connexion?erreur=lien");
  const sb = await userClient();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("/connexion?erreur=lien");
  const name = (data.user.user_metadata?.name as string | undefined) ?? null;
  const { error: wsError } = await sb.rpc("ensure_workspace", { ws_name: name ? `Espace de ${name}` : null });
  if (wsError) return back("/connexion?erreur=espace");
  const { count } = await sb.from("sites").select("id", { count: "exact", head: true });
  return back(count ? "/app" : "/onboarding/site");
}
