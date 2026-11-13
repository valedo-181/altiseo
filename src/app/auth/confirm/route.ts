import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { userClient } from "@/lib/supabase/server";
import { finishLogin } from "@/lib/auth/finish-login";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Lien de l'e-mail de connexion (modèles Supabase « Magic Link » et « Confirm signup ») :
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * Contrairement au flux PKCE (/auth/callback), il marche dans n'importe quel navigateur ou appareil :
 * aucune donnée n'est attendue dans le navigateur qui a demandé le lien.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) return back("/connexion?erreur=lien");
  const sb = await userClient();
  const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error || !data.user) {
    console.error("auth.confirm", { status: error?.status, code: (error as { code?: string } | null)?.code });
    return back("/connexion?erreur=lien");
  }
  const next = await finishLogin(sb, data.user);
  return back(next ?? "/connexion?erreur=espace");
}
