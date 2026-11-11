import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { supabaseUrl } from "./url";

const systemMode = new AsyncLocalStorage<true>();

/**
 * Tâches de fond (publication automatique) : il n'y a personne de connecté, donc pas de session.
 * Dans `fn`, userClient() rend le client service_role. À n'appeler que depuis une tâche authentifiée
 * par CRON_SECRET, et seulement avec des identifiants d'espace et de site lus dans la base.
 */
export function runAsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return systemMode.run(true, fn);
}

/** Client au nom de la personne connectée : la RLS de la base décide de ce qu'elle voit. */
export async function userClient(): Promise<SupabaseClient> {
  if (systemMode.getStore()) return adminClient();
  const store = await cookies();
  return createServerClient(supabaseUrl()!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
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
  admin ??= createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
