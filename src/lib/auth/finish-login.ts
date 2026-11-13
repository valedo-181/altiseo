import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Après l'ouverture de la session (lien ou code) : crée l'espace au premier passage
 * (ensure_workspace), puis choisit la page d'arrivée. Renvoie null si l'espace n'a pas pu être créé.
 */
export async function finishLogin(sb: SupabaseClient, user: User): Promise<string | null> {
  const name = (user.user_metadata?.name as string | undefined) ?? null;
  const { error } = await sb.rpc("ensure_workspace", { ws_name: name ? `Espace de ${name}` : null });
  if (error) return null;
  const { count } = await sb.from("sites").select("id", { count: "exact", head: true });
  return count ? "/app" : "/onboarding/site";
}
