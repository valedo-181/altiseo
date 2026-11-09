import "server-only";
import { config } from "@/lib/config";
import { demoDb } from "./demo-store";
import { supabaseDb } from "./supabase-store";

export { AccessDenied, Conflict, QuotaReached } from "./errors";

/** Supabase dès que ses clés sont là, sinon le fichier de démonstration. Mêmes fonctions des deux côtés. */
export const db: typeof demoDb = config.supabase ? (supabaseDb as unknown as typeof demoDb) : demoDb;

// Les deux implémentations doivent garder la même forme : erreur de compilation sinon.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _shape: Same<keyof typeof demoDb, keyof typeof supabaseDb> = true;
void _shape;
