/**
 * L'entreprise qui exploite Altiseo, telle qu'inscrite au registre du commerce. Ces lignes alimentent
 * les mentions légales, la politique de confidentialité et les conditions d'utilisation.
 * Tant qu'un champ obligatoire est vide, les trois pages restent introuvables et leurs liens masqués :
 * on ne publie pas de pages légales à trous.
 */
export const COMPANY = {
  /** Raison sociale exacte, forme juridique comprise (ex. « Exemple Sàrl »). */
  name: "",
  /** Rue et numéro. */
  street: "",
  /** Code postal et localité (ex. « 1000 Lausanne »). */
  city: "",
  /** Numéro d'identification des entreprises (ex. « CHE-123.456.789 »). Facultatif pour une personne non inscrite. */
  ide: "",
  /** Adresse de contact affichée, aussi pour les demandes liées aux données personnelles. */
  email: "",
  /** Lieu du for juridique (en général le siège, ex. « Lausanne »). */
  forum: "",
} as const;

export const LEGAL_UPDATED = "15 novembre 2026";

export const legalReady = Boolean(COMPANY.name && COMPANY.street && COMPANY.city && COMPANY.email && COMPANY.forum);

export const LEGAL_PAGES = [
  ["/mentions-legales", "Mentions légales"],
  ["/confidentialite", "Confidentialité"],
  ["/conditions", "Conditions d'utilisation"],
] as const;

/**
 * Les prestataires qui traitent des données pour Altiseo. À tenir à jour à chaque nouveau service
 * branché : c'est une obligation d'information (loi sur la protection des données, art. 19).
 */
export const PROCESSORS: Array<{ name: string; role: string; data: string; where: string }> = [
  { name: "Supabase", role: "Base de données, comptes et stockage des images", data: "Compte, réglages, sites, articles, statistiques", where: "Union européenne (Irlande)" },
  { name: "Vercel", role: "Hébergement de l'application", data: "Tout ce qui transite par l'application, journaux techniques", where: "Union européenne (Irlande) ; société établie aux États-Unis" },
  { name: "Anthropic (Claude)", role: "Rédaction des sujets, des articles et des annonces", data: "Description de votre activité, contenu public de votre site, vos consignes", where: "États-Unis" },
  { name: "Higgsfield", role: "Création des images d'articles", data: "Description de l'image à créer (sans donnée personnelle)", where: "États-Unis" },
  { name: "Google", role: "Search Console, mesure de vitesse des pages (si vous connectez votre compte)", data: "Adresse de votre site, statistiques de recherche de votre site", where: "États-Unis et Union européenne" },
  { name: "GitHub ou votre WordPress", role: "Envoi des articles sur votre site (selon la connexion choisie)", data: "Les articles et leurs images", where: "Selon votre hébergeur ; GitHub : États-Unis" },
  { name: "OpenAI, Google Gemini, Perplexity", role: "Visibilité IA (si la fonction est active)", data: "Les questions suivies (sans donnée personnelle)", where: "États-Unis" },
  { name: "DataForSEO", role: "Positions Google (si la fonction est active)", data: "Vos mots-clés et l'adresse de votre site", where: "Union européenne et États-Unis" },
  { name: "Resend", role: "Envoi des e-mails (si la fonction est active)", data: "Adresse e-mail, contenu du message", where: "États-Unis" },
];
