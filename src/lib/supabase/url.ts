/**
 * Adresse du projet Supabase, nettoyée : on accepte aussi l'adresse « Data API » affichée par Supabase
 * (…supabase.co/rest/v1/), source fréquente d'erreur, et on n'en garde que l'origine.
 */
export function cleanSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  try {
    return new URL(s).origin;
  } catch {
    return s.replace(/\/+$/, "");
  }
}

export const supabaseUrl = () => cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
