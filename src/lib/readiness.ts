import "server-only";
import { config } from "@/lib/config";

const has = (...names: string[]) => names.every((n) => Boolean(process.env[n]?.trim()));

/**
 * Ce qui est réellement branché sur ce serveur, fonction par fonction. Le site public n'annonce que ce
 * qui est prêt : une fonction dont le service manque est masquée (accueil, services, tarifs) et revient
 * toute seule au déploiement suivant une fois ses variables ajoutées. La console admin liste le tout.
 * `needs` : les variables à ajouter dans Vercel, pour l'affichage dans la console.
 */
export const READINESS = {
  writing: { label: "Rédaction (Claude)", ready: config.ai, needs: "ANTHROPIC_API_KEY" },
  sending: { label: "Envoi réel sur WordPress ou GitHub", ready: config.cms, needs: "ENCRYPTION_KEY" },
  images: { label: "Images des articles (Higgsfield)", ready: config.images, needs: "HIGGSFIELD_KEY_ID" },
  autopublish: { label: "Publication automatique", ready: has("CRON_SECRET"), needs: "CRON_SECRET" },
  ads: { label: "Publicités : annonces Google et Meta prêtes à lancer", ready: config.ai, needs: "ANTHROPIC_API_KEY" },
  keywords: { label: "Mots-clés (Google Search Console)", ready: config.search, needs: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et ENCRYPTION_KEY" },
  positions: { label: "Positions Google (DataForSEO)", ready: has("DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"), needs: "DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD" },
  // Les quatre IA annoncées doivent répondre : une seule clé manquante et la fonction n'est pas montrée.
  aiVisibility: { label: "Visibilité IA (ChatGPT, Gemini, Perplexity, Claude)", ready: has("OPENAI_API_KEY", "GEMINI_API_KEY", "PERPLEXITY_API_KEY", "ANTHROPIC_API_KEY"), needs: "OPENAI_API_KEY, GEMINI_API_KEY et PERPLEXITY_API_KEY" },
  stats: { label: "Statistiques de visites", ready: Boolean(process.env.ALTISEO_STATS_SECRET?.trim() || process.env.ALTISEO_SESSION_SECRET?.trim()), needs: "ALTISEO_STATS_SECRET" },
  indexing: { label: "Indexation (état Google des pages)", ready: config.search, needs: "les mêmes variables que les mots-clés" },
  guardian: { label: "Gardien du site (alertes par e-mail)", ready: has("RESEND_API_KEY", "ALERT_FROM", "CRON_SECRET"), needs: "RESEND_API_KEY et ALERT_FROM" },
  report: { label: "Rapport mensuel en PDF", ready: true, needs: "" },
  reportEmail: { label: "Envoi du rapport par e-mail", ready: has("RESEND_API_KEY", "ALERT_FROM"), needs: "RESEND_API_KEY et ALERT_FROM" },
} as const;

export type Feature = keyof typeof READINESS;
export const isReady = (f: Feature) => READINESS[f].ready;
