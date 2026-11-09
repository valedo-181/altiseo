import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Client au nom de la personne connectée : la RLS de la base décide de ce qu'elle voit. */
export async function userClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Appelé depuis une page (lecture seule) : le middleware rafraîchit la session.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/**
 * Client « service_role » : passe outre la RLS. Uniquement côté serveur, uniquement après avoir
 * vérifié avec userClient() que la personne a le droit (ou dans les tâches de fond).
 */
export function adminClient(): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant");
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
