/**
 * Calendrier de sujets en MODE DÉMO : modèles de titres combinés au thème du site, sans données de
 * mots-clés (volume et difficulté restent vides). La vraie version (DataForSEO + Claude) remplacera
 * planDemoTopics sans changer la forme des sujets. Voir replica/architecture.md, « Rédaction ».
 */
import { publishDates } from "./dates.ts";

export type TopicDraft = { scheduledFor: string; title: string; angle: string; keyword: string };

const TEMPLATES: Array<[string, string, string]> = [
  // [titre, angle, mot-clé] ; {t} = thème, {T} = thème avec majuscule, {y} = année
  ["{T} : combien ça coûte en {y} ?", "Fourchettes de prix, ce qui fait varier le coût, comment comparer les offres.", "prix {t}"],
  ["{T} : les 7 erreurs à éviter", "Erreurs fréquentes des clients et comment les éviter.", "erreurs {t}"],
  ["{T} : le guide complet pour bien débuter", "Article pilier : définitions, étapes, conseils, liens vers les articles détaillés.", "guide {t}"],
  ["{T} : comment choisir son prestataire ?", "Critères de choix, questions à poser, signaux d'alerte.", "choisir {t}"],
  ["{T} : check-list à télécharger", "Liste d'étapes pratique, à imprimer.", "check-list {t}"],
  ["{T} : les questions les plus fréquentes", "FAQ : 8 à 10 questions réelles de clients, réponses courtes.", "questions {t}"],
  ["{T} : combien de temps faut-il prévoir ?", "Délais habituels, planning type, comment gagner du temps.", "délai {t}"],
  ["{T} en hiver : nos conseils", "Contraintes saisonnières et solutions.", "{t} hiver"],
  ["{T} pas cher : est-ce possible ?", "Où économiser sans mauvaise surprise, ce qu'il ne faut pas sacrifier.", "{t} pas cher"],
  ["{T} pour les entreprises : ce qui change", "Besoins des clients professionnels, contrats, délais.", "{t} entreprise"],
  ["{T} : le planning semaine par semaine", "Rétroplanning concret.", "préparer {t}"],
  ["{T} : quelles assurances et garanties ?", "Ce qui est couvert, ce qui ne l'est pas, quoi vérifier.", "assurance {t}"],
  ["{T} : comment lire un devis ?", "Lignes d'un devis, pièges, comparaison de deux devis.", "devis {t}"],
  ["{T} écologique : les bonnes pratiques", "Réduire l'impact, matériel réutilisable, recyclage.", "{t} écologique"],
  ["{T} : 10 astuces de pros", "Astuces concrètes tirées du terrain.", "astuces {t}"],
  ["{T} en urgence : que faire ?", "Les bons réflexes quand le temps manque.", "{t} urgent"],
  ["{T} : faire appel à un pro ou le faire soi-même ?", "Comparatif honnête : seul ou avec un professionnel.", "{t} soi-même"],
  ["{T} : les aides et déductions possibles", "Aides, frais déductibles, justificatifs à garder.", "aide {t}"],
  ["{T} : les outils indispensables", "Matériel, applications, fournitures.", "outils {t}"],
  ["{T} avec des enfants : nos conseils", "Organisation familiale, astuces pour les plus petits.", "{t} enfants"],
  ["{T} et animaux de compagnie", "Préparer et rassurer son animal.", "{t} animaux"],
  ["{T} : ce que personne ne vous dit", "Coûts cachés et détails oubliés.", "{t} conseils"],
  ["{T} : avant, pendant, après", "Les trois phases, avec une liste de tâches pour chacune.", "étapes {t}"],
  ["{T} : quelle saison choisir ?", "Avantages et inconvénients de chaque période.", "meilleure période {t}"],
  ["{T} : retour d'expérience d'un client", "Cas client raconté étape par étape (avec son accord).", "exemple {t}"],
  ["{T} : les termes à connaître", "Petit lexique pour comprendre les devis et les échanges.", "lexique {t}"],
  ["{T} : comment éviter le stress ?", "Organisation, délégation, préparation mentale.", "{t} stress"],
  ["{T} et voisinage : les règles à respecter", "Autorisations, horaires, courtoisie.", "{t} règles"],
  ["{T} : les tendances {y}", "Ce qui change cette année dans le métier.", "tendances {t}"],
  ["{T} : notre méthode en 5 étapes", "Présenter votre façon de travailler, sans jargon.", "méthode {t}"],
  ["{T} : le budget détaillé poste par poste", "Ventilation d'un budget réel, avec les postes souvent oubliés.", "budget {t}"],
  ["{T} : ce que dit la loi en Suisse", "Règles, obligations et droits du client, expliqués simplement.", "{t} loi suisse"],
  ["{T} en ville ou à la campagne : les différences", "Contraintes d'accès, délais et prix selon le lieu.", "{t} ville campagne"],
  ["{T} : comment se passe le premier rendez-vous ?", "Déroulé, questions posées, documents à préparer.", "rendez-vous {t}"],
  ["{T} : 5 idées reçues à oublier", "Démêler le vrai du faux.", "idées reçues {t}"],
  ["{T} pour les seniors : nos conseils", "Accompagnement, rythme, aides possibles.", "{t} seniors"],
  ["{T} et télétravail : bien s'organiser", "Concilier le projet avec le travail à la maison.", "{t} télétravail"],
  ["{T} : quels documents garder ?", "Factures, contrats, garanties : quoi archiver et combien de temps.", "documents {t}"],
  ["{T} de dernière minute : est-ce possible ?", "Ce qui reste faisable, à quel prix.", "{t} dernière minute"],
  ["{T} : comparer les offres sans se tromper", "Grille de comparaison simple.", "comparer {t}"],
  ["{T} : les signes d'un prestataire sérieux", "Labels, avis, contrat, assurance.", "prestataire {t} sérieux"],
  ["{T} : que faire en cas de litige ?", "Démarches, recours, médiation.", "litige {t}"],
  ["{T} : notre lexique des prix", "Forfait, heure, mètre cube… comprendre les unités.", "tarif {t}"],
  ["{T} : préparer son budget à l'avance", "Épargne, devis, marge pour les imprévus.", "financer {t}"],
  ["{T} : les questions à poser avant de signer", "Liste de questions à imprimer.", "questions avant {t}"],
];

export function planDemoTopics(theme: string, from: string, count: number, publishDays: number[], skip: Set<string> = new Set()): TopicDraft[] {
  const t = theme.trim().toLowerCase() || "votre activité";
  const T = t.charAt(0).toUpperCase() + t.slice(1);
  const y = from.slice(0, 4);
  const fill = (s: string) => s.replaceAll("{t}", t).replaceAll("{T}", T).replaceAll("{y}", y);
  const pool = TEMPLATES.filter(([title]) => !skip.has(fill(title)));
  return publishDates(from, count, publishDays).map((day, i) => {
    const [title, angle, kw] = pool[i % pool.length];
    return { scheduledFor: day, title: fill(title), angle: fill(angle), keyword: fill(kw) };
  });
}

/** Un autre sujet pour le même jour, différent de tous ceux déjà au calendrier. */
export function alternativeDemoTopic(theme: string, day: string, taken: Set<string>, seed: number): TopicDraft | null {
  const all = planDemoTopics(theme, day, TEMPLATES.length, [1, 2, 3, 4, 5, 6, 7]);
  const free = all.filter((x) => !taken.has(x.title));
  if (!free.length) return null;
  const pick = free[seed % free.length];
  return { ...pick, scheduledFor: day };
}
