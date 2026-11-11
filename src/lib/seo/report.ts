/**
 * Du résultat de l'audit (audit.ts) à ce que l'app enregistre et affiche : niveaux, libellés et
 * conseils en clair. Fonctions pures, testées dans report.test.ts.
 */
import type { AuditIssue, AuditLevel } from "../domain/types.ts";
import { CHECKS, issueImpact, type Issue, type IssueCode } from "./audit.ts";

const LEVEL: Record<"critique" | "moyen" | "info", AuditLevel> = { critique: "critical", moyen: "warning", info: "info" };

/** Les contrôles en échec, du plus coûteux en points au moins coûteux ; les réussis ne sont pas gardés. */
export function toAuditIssues(issues: Issue[]): AuditIssue[] {
  const order: Record<AuditLevel, number> = { critical: 0, warning: 1, info: 2 };
  return issues
    .filter((i) => i.level !== "ok")
    .map((i) => ({ i, level: LEVEL[i.level as "critique" | "moyen" | "info"] }))
    .sort((a, b) => order[a.level] - order[b.level] || issueImpact(b.i) - issueImpact(a.i))
    .map(({ i, level }) => ({ code: i.code, level, affected: i.count, total: i.total, pages: i.pages.slice(0, 10), detail: i.detail == null ? null : String(i.detail) }));
}

export const LEVEL_LABEL: Record<AuditLevel, string> = { critical: "Critique", warning: "Moyen", info: "Info" };

type Text = { title: string; why: string; fix: string };

/** Libellé, raison et correction de chaque contrôle, écrits pour un non-spécialiste. */
export const ISSUE_TEXT: Record<IssueCode, Text> = {
  https: { title: "Le site n'est pas en HTTPS", why: "Les navigateurs affichent « non sécurisé » et Google préfère les sites en HTTPS.", fix: "Activez le certificat SSL chez votre hébergeur (souvent gratuit, en un clic) et redirigez http vers https." },
  indexable: { title: "Des pages demandent à ne pas apparaître dans Google", why: "Une page marquée « noindex » est invisible dans les résultats de recherche.", fix: "Retirez la balise « noindex » des pages que vous voulez voir dans Google. Dans WordPress : Réglages → Lecture, décochez « Demander aux moteurs de recherche de ne pas indexer ce site »." },
  title: { title: "Titres de page absents, trop courts ou trop longs", why: "Le titre est le lien bleu affiché dans Google : c'est le premier critère de classement et ce qui donne envie de cliquer.", fix: "Donnez à chaque page un titre unique de 15 à 70 caractères, qui dit ce qu'on y trouve et où (« Déménagement à Lausanne : devis gratuit »)." },
  description: { title: "Descriptions absentes, trop courtes ou trop longues", why: "La description est le texte gris sous le lien dans Google. Sans elle, Google en invente une.", fix: "Écrivez pour chaque page une description de 50 à 170 caractères qui résume la page et invite à cliquer." },
  h1: { title: "Pages sans titre principal, ou avec plusieurs", why: "Le titre principal (H1) dit à Google et au lecteur de quoi parle la page.", fix: "Gardez un seul titre principal par page ; passez les autres en intertitres (H2)." },
  img_alt: { title: "Images sans texte alternatif", why: "Ce texte décrit l'image aux personnes malvoyantes et à Google Images.", fix: "Ajoutez à chaque image une courte description de ce qu'elle montre (champ « Texte alternatif »)." },
  viewport: { title: "Le site n'est pas prévu pour les téléphones", why: "Plus de la moitié des recherches se font sur téléphone, et Google juge d'abord la version mobile.", fix: "Utilisez un thème adaptatif (« responsive »). Techniquement : la balise meta viewport manque dans l'en-tête." },
  speed: { title: "Le site est lent sur téléphone", why: "Un site lent fait fuir les visiteurs et descend dans les résultats.", fix: "Compressez les images (format WebP), retirez les extensions inutiles et activez un cache chez votre hébergeur." },
  local_business: { title: "Pas de données structurées", why: "Ces informations cachées (schema.org) aident Google à comprendre votre activité et à afficher des résultats enrichis.", fix: "Ajoutez un bloc JSON-LD décrivant votre entreprise (nom, adresse, téléphone, horaires). La plupart des extensions SEO le font pour vous." },
  phone: { title: "Votre téléphone n'apparaît pas sur le site", why: "Les clients et Google doivent trouver le même numéro partout.", fix: "Affichez votre numéro en texte (pas seulement en image), par exemple en pied de page." },
  address: { title: "Votre adresse n'apparaît pas sur le site", why: "L'adresse en texte aide le référencement local.", fix: "Ajoutez votre adresse complète en pied de page ou sur la page Contact." },
  sitemap: { title: "Pas de plan du site (sitemap)", why: "Le plan du site donne à Google la liste de vos pages : elles sont trouvées plus vite.", fix: "Activez le sitemap (intégré à WordPress depuis la version 5.5, à l'adresse /wp-sitemap.xml) et déclarez-le dans Google Search Console." },
  broken: { title: "Liens cassés", why: "Un lien qui mène à une erreur déçoit le visiteur et gaspille le passage de Google.", fix: "Corrigez ou retirez ces liens ; si une page a changé d'adresse, créez une redirection." },
  title_duplicate: { title: "Plusieurs pages portent le même titre", why: "Google ne sait pas laquelle afficher et elles se font concurrence.", fix: "Donnez un titre différent à chaque page, centré sur son sujet propre." },
  thin: { title: "Pages avec très peu de texte", why: "Une page de moins de 250 mots a peu de chances de bien se classer.", fix: "Étoffez ces pages (questions fréquentes, exemples, détails de l'offre) ou regroupez-les." },
};

export const issueText = (code: string): Text =>
  (ISSUE_TEXT as Record<string, Text>)[code] ?? { title: code, why: "", fix: "" };

/** « 12 pages sur 48 », « 9 images sur 130 », ou la note de vitesse. */
export function issueScope(i: AuditIssue): string {
  if (i.code === "speed") return i.detail ? `note ${i.detail} sur 100` : "";
  if (!i.total) return "";
  const unit = i.code === "img_alt" ? "image" : i.code === "broken" ? "lien" : "page";
  return `${i.affected} ${unit}${i.affected > 1 ? "s" : ""} sur ${i.total}`;
}

export const scoreTone = (score: number): "danger" | "warning" | "success" => (score < 50 ? "danger" : score < 90 ? "warning" : "success");
export const CHECK_COUNT = Object.keys(CHECKS).length;
