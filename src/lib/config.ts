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
};

export const demoMode = !config.supabase;

/** Adresse publique de l'application (liens de connexion par e-mail). */
export function siteOrigin(fallback?: string): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? fallback ?? "http://localhost:3000").replace(/\/$/, "");
}
