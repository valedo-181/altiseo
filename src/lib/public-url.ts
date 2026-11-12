/**
 * Adresse officielle du site public, pour Google : adresses canoniques, plan du site, aperçus de partage.
 * Les liens de connexion, eux, suivent l'adresse sur laquelle la personne se trouve (voir siteOrigin).
 */
export const PUBLIC_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.altiseo.ch").trim().replace(/\/+$/, "");

/** Pages publiques à faire connaître à Google. Le reste (app, console, onboarding) reste hors index. */
export const PUBLIC_PAGES = ["/", "/services", "/tarifs", "/inscription", "/connexion"] as const;
