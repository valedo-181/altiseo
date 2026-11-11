import "server-only";

/**
 * Ce qui est branché. Sans clés, l'application tourne en mode démo (fichier local, textes d'exemple,
 * envoi simulé). Chaque service s'active dès que ses variables sont présentes (voir .env.example).
 */
export const config = {
  supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseAdmin: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  ai: Boolean(process.env.ANTHROPIC_API_KEY),
  /** Envoi réel aux CMS : base réelle + clé de chiffrement des identifiants. */
  cms: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ENCRYPTION_KEY),
  /** Google Search Console : identifiants OAuth de Google + de quoi garder le jeton chiffré. */
  search: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ENCRYPTION_KEY),
};

export const demoMode = !config.supabase;

/**
 * Adresse publique de l'application (liens de connexion par e-mail). On prend d'abord l'adresse sur
 * laquelle la personne se trouve (toujours juste), puis NEXT_PUBLIC_SITE_URL si elle manque.
 */
export function siteOrigin(current?: string): string {
  return (current || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim().replace(/\/+$/, "");
}
