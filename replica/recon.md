# Carte de reconnaissance : Babylovegrowth (web)

Périmètre : la boucle principale (analyse du site, calendrier de mots-clés,
rédaction d'articles par IA, publication automatique sur le CMS) **plus l'audit
SEO technique**. Hors périmètre : le réseau d'échange de backlinks et le suivi
de visibilité dans les IA (ChatGPT, Claude, Gemini…).
Pour : un **produit SaaS séparé**, à vendre à des PME, indépendants et
e-commerçants (pas un module de Titanor).
Date : 2026-11-06

> **Comment cette carte a été faite.** Le réseau de cette session bloque
> babylovegrowth.ai et tous les sites tiers : aucune page n'a pu être ouverte.
> Tout ce qui suit vient des **extraits de résultats de recherche web**
> (documentation officielle indexée et avis tiers). Aucun compte n'a été
> utilisé, aucune capture d'écran n'a été prise (`replica/screens/` est vide).
> Les écrans sont donc **déduits**, pas observés : leur niveau de confiance est
> indiqué. Les conditions d'utilisation n'ont pas pu être lues.
>
> Pour fiabiliser : autoriser `www.babylovegrowth.ai` dans les réglages réseau
> de l'environnement (docs, tarifs), ou envoyer des captures d'écran du site
> public ou de votre propre compte.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | docs officielles : FAQ | https://www.babylovegrowth.ai/docs/questions | CMS : WordPress, Shopify, Webflow, Framer, API (lu via extraits de recherche) |
| 2 | docs officielles : qualité des articles | https://www.babylovegrowth.ai/docs/dashboard/article-quality | jusqu'à 10 liens internes, section « articles recommandés », ton de la marque |
| 3 | docs officielles : réglages | https://www.babylovegrowth.ai/docs/dashboard/settings | instructions perso (1000 caractères), « mentionner les concurrents », rédaction / visuels / planning |
| 4 | docs officielles : API | https://www.babylovegrowth.ai/docs/integrations/api | renvoie `seedKeyword` et `keywords` par article |
| 5 | docs officielles : accueil | https://www.babylovegrowth.ai/docs/ | |
| 6 | plugin WordPress | https://nl.wordpress.org/plugins/babylovegrowth-integration/ | endpoint REST, clé API sans login, option brouillon |
| 7 | plugin Framer | https://www.framer.com/marketplace/plugins/babylovegrowth | |
| 8 | test de 45 jours | https://aboahreviews.com/babylovegrowth-ai-review/ | onboarding en 7 étapes, champs pré-remplis, CMS détecté depuis le domaine, paywall |
| 9 | présentation complète | https://aboahreviews.com/what-is-babylovegrowth-ai/ | |
| 10 | tarifs (avis) | https://aboahreviews.com/babylovegrowth-ai-pricing/ | |
| 11 | tarifs (avis) | https://seonix.ai/blog/babylovegrowth-pricing | anciens paliers Starter / Growth / Agency |
| 12 | tarifs (avis) | https://ecommerceparadise.com/babylovegrowth-pricing/ | |
| 13 | avis + risques | https://whataidoineed.com/tool/babylovegrowth | langues en plus sur Scale, risques GEO et backlinks |
| 14 | avis G2 | https://www.g2.com/products/babylovegrowth/reviews | audit : schema, meta, liens cassés, alt, sitemap, vitesse |
| 15 | comparatif | https://keytomic.com/blog/babylovegrowth-vs-keytomic | édition limitée au niveau de l'article |
| 16 | comparatif | https://www.blogseo.io/blogseo-vs-babylovegrowth | liste des CMS, pas de Notion |
| 17 | avis sur le réseau de liens | https://organikpi.com/blog/reviews/babylovegrowth-review/ | |
| 18 | avis Trustpilot | https://at.trustpilot.com/review/babylovegrowth.ai | signalé pour avis incités |

Pas de changelog public trouvé. Pas de fiche App Store (produit web uniquement).

## Boucle principale

L'utilisateur donne l'URL de son site une seule fois. Le produit en déduit son
activité, son public et ses concurrents, construit un calendrier de 30 jours de
sujets avec mots-clés, puis rédige un article SEO par jour et le publie tout
seul sur le CMS. Le client paie pour **ne plus avoir à écrire son blog**.

## Tarifs observés (à revérifier : les sources ne s'accordent pas)

| offre | prix / mois | contenu | source |
| --- | --- | --- | --- |
| Grow | 99 $ (49 $ selon une source) | 30 articles, 1 langue (ou 20+ selon une source), essai 3 jours | 10, 12, 13 |
| Scale | 299 $ (199 $, 399 $ selon d'autres) | 30 articles (120 selon une source), +3 langues, support prioritaire | 10, 13 |
| annuel | -25 % | | 11 |
| anciens paliers | Starter 49 $ / Growth 99 $ / Agency 249 $ | 10 / 30 / 100 articles | 11 |

Le prix est fixé par volume d'articles et par nombre de langues.

## Écrans

Tous **déduits** des sources (aucun observé). Confiance : H = plusieurs sources,
M = une source, G = supposition.

| ID | écran | route / accès | but | composants clés | états à prévoir | conf. |
| --- | --- | --- | --- | --- | --- | --- |
| S01 | Site vitrine | `/` | promesse, preuve, CTA essai | hero, champ URL, sections, FAQ | mobile | H |
| S02 | Tarifs | `/pricing` | choisir une offre | cartes d'offres, bascule mensuel / annuel | mobile | H |
| S03 | Inscription / connexion | `/signup`, `/login` | créer un compte | formulaire, Google | erreur, e-mail déjà pris | M |
| S04 | Onboarding 1 : URL du site | `/onboarding` | point de départ de tout | champ URL, bouton analyser | analyse en cours, URL invalide, site injoignable | H |
| S05 | Onboarding 2 : activité et public | `/onboarding` étape 2 | décrire le business | textarea pré-remplie, public cible | pré-rempli, modifié | H |
| S06 | Onboarding 3 : concurrents | `/onboarding` étape 3 | 3+ concurrents | liste d'URL suggérées, ajouter / retirer | suggéré, vide, moins de 3 | H |
| S07 | Onboarding 4 : langue et ton | `/onboarding` étape 4 | langue, voix de marque | sélecteur de langue, choix de ton | | G |
| S08 | Onboarding 5 : connexion CMS | `/onboarding` étape 5 | où publier | CMS détecté, cartes CMS, champs clé API / URL | détecté, non détecté, test OK, test échoué | H |
| S09 | Onboarding 6 : planning | `/onboarding` étape 6 | heure de publication quotidienne | heure, fuseau, brouillon ou publié | | M |
| S10 | Onboarding 7 : offre et essai | `/onboarding` étape 7 | activer l'essai de 3 jours | cartes d'offres, paiement | paiement refusé | H |
| S11 | Tableau de bord | `/dashboard` | vue d'ensemble | KPI (articles publiés, trafic), prochains articles, dernier audit | vide (premier jour), rempli | M |
| S12 | Calendrier de contenu | `/calendar` | voir et valider 30 jours de sujets | grille ou liste par jour, volume, difficulté, approuver, régénérer | génération en cours, vide, rempli | H |
| S13 | Liste des articles | `/articles` | tous les articles et leur statut | tableau, filtres par statut, recherche | vide, rempli, échec de publication | M |
| S14 | Détail / éditeur d'article | `/articles/:id` | relire, corriger, publier | éditeur riche, méta (titre SEO, description, slug), mots-clés, image, aperçu, publier / republier | brouillon, publié, échec, régénération | M |
| S15 | Audit technique | `/audit` | santé SEO du site | score, problèmes par catégorie et gravité, lancer l'audit | jamais lancé, en cours, terminé, site injoignable | H |
| S16 | Détail d'un problème | `/audit/:issue` | comprendre et corriger | pages touchées, explication, recommandation | | M |
| S17 | Intégrations | `/settings/integrations` | gérer les CMS | cartes CMS, statut, tester, déconnecter | connecté, en erreur | H |
| S18 | Réglages : rédaction | `/settings/writing` | contrôler les articles | instructions perso (1000 car.), mentionner les concurrents, longueur, langue | | H |
| S19 | Réglages : visuels | `/settings/visuals` | images des articles | style d'image, image à la une oui / non | | M |
| S20 | Réglages : planning | `/settings/schedule` | rythme de publication | fréquence, heure, brouillon ou publication directe | | M |
| S21 | Clés API / webhook | `/settings/api` | sites sur mesure | clé API, URL de webhook, journal des envois | | H |
| S22 | Abonnement | `/settings/billing` | offre, factures, annuler | offre actuelle, quota d'articles, portail de paiement | essai, actif, en retard, annulé | M |
| S23 | Sélecteur de sites (projets) | menu du haut | plusieurs sites par compte | liste de sites, ajouter un site | | G |

## Parcours

```
F01 Nouveau client jusqu'au premier calendrier
    S01 -> S03 -> S04 -> S05 -> S06 -> S07 -> S08 -> S09 -> S10 -> S12
    clics sur le chemin heureux : ~12 (7 étapes pré-remplies, chacune « suivant »)
    limites : site injoignable, site sans contenu, pas de CMS détecté,
              concurrents introuvables, paiement refusé, langue non gérée

F02 Valider ou changer un sujet du calendrier
    S12 -> approuver | régénérer | supprimer
    clics : 1 par sujet
    limites : régénérer à l'infini (coût IA), sujet déjà traité par un article existant

F03 Article quotidien automatique (tâche de fond, sans clic)
    sujet du jour (S12) -> rédaction IA -> liens internes -> image -> publication CMS -> S13
    limites : CMS hors ligne, clé révoquée, quota épuisé, doublon (rejouer deux fois),
              changement d'heure, article raté (trop court, langue fausse)

F04 Relire avant publication (mode brouillon)
    S13 -> S14 -> corriger -> publier
    clics : 3
    limites : article modifié dans le CMS après publication, republier écrase les corrections

F05 Connecter un CMS
    S17 -> choisir le CMS -> clé / plugin / OAuth -> tester
    clics : 4 à 6 (WordPress : installer le plugin et coller une clé)
    limites : hébergement WordPress non standard, droits insuffisants, Webflow capricieux

F06 Lancer un audit technique et corriger
    S15 -> lancer -> attendre -> S16 -> corriger sur son site -> relancer
    clics : 2 pour lancer, 1 par problème
    limites : gros site (limite de pages), robots.txt qui bloque, pages lentes, site JS

F07 Régler la rédaction
    S18 -> modifier les instructions -> enregistrer (s'applique aux prochains articles)
    clics : 2

F08 Gérer l'abonnement ou annuler
    S22 -> portail de paiement -> changer d'offre | annuler
    clics : 2 à 3 (l'annulation doit se faire en un clic)

F09 Ajouter un deuxième site
    S23 -> ajouter -> F01 à partir de S04
```

## Composants

| composant | variantes | états | utilisé sur |
| --- | --- | --- | --- |
| Bouton | primaire, secondaire, fantôme, danger | défaut, survol, focus, désactivé, chargement | partout |
| Champ texte / URL | simple, avec préfixe `https://` | vide, rempli, erreur, désactivé | S03, S04, S06, S21 |
| Zone de texte avec compteur | 1000 caractères | vide, proche de la limite, dépassé | S05, S18 |
| Étapes d'onboarding | barre de progression 7 étapes | actuelle, faite, à venir | S04–S10 |
| Carte d'offre | mensuel, annuel, recommandée | sélectionnée | S02, S10, S22 |
| Carte CMS | WordPress, Shopify, Webflow, Framer, Wix, Ghost, webhook, API | non connecté, connecté, en erreur, détecté | S08, S17 |
| Carte KPI | nombre, évolution | chargement, vide | S11 |
| Vue calendrier | mois, liste | jour vide, sujet planifié, publié, échec | S12 |
| Pastille de statut | planifié, rédaction, brouillon, publié, échec | | S12, S13, S14 |
| Indicateur volume / difficulté | barre ou pastille couleur | | S12, S14 |
| Tableau | tri, filtre, recherche, pagination | vide, chargement, rempli | S13, S15, S16 |
| Éditeur riche | titres, listes, liens, images | lecture, édition, enregistrement | S14 |
| Panneau méta SEO | titre, description, slug, mots-clés | trop long, OK | S14 |
| Score d'audit | jauge 0–100 | en cours, jamais lancé | S11, S15 |
| Ligne de problème | critique, avertissement, info | corrigé, ouvert | S15, S16 |
| Bascule (switch) | | on, off, désactivé | S18, S19, S20 |
| Sélecteur d'heure + fuseau | | | S09, S20 |
| Toast | succès, erreur | | partout |
| Modale de confirmation | danger | | S14, S17, S22 |
| Sélecteur de site | | un site, plusieurs | S23 |
| Bandeau d'essai / quota | essai, quota bas, paiement en retard | | toutes les pages connectées |

## Modèle de données déduit

```
User          id, email, name, locale
              preuve : S03            confiance : high

Workspace     id, owner_id, name
              preuve : S23 (plusieurs sites par compte)   confiance : guess

Site          id, workspace_id, url, language, business_description,
              target_audience, tone, custom_instructions (≤1000),
              mention_competitors (bool), timezone
              preuve : S04–S07, S18, docs réglages        confiance : high

Competitor    id, site_id, url, name, source (suggested | manual)
              preuve : S06, onboarding « 3+ concurrents »  confiance : high

Integration   id, site_id, kind (wordpress | shopify | webflow | framer | wix |
              ghost | webhook | api), credentials (chiffrées), status,
              publish_mode (draft | publish), last_tested_at
              preuve : S08, S17, plugin WordPress (clé API, brouillons)  confiance : high

Keyword       id, site_id, phrase, search_volume, difficulty, intent
              preuve : S12 (volume et difficulté), API (`keywords`)    confiance : medium

CalendarItem  id, site_id, scheduled_for (date), title, seed_keyword_id,
              status (proposed | approved | generating | done | failed | skipped)
              preuve : S12, calendrier 30 jours, approuver / régénérer   confiance : high

Article       id, site_id, calendar_item_id, title, slug, meta_title,
              meta_description, body (html/markdown), language, keywords[],
              featured_image_url, schema_jsonld, internal_links[] (≤10),
              status (draft | scheduled | published | failed), word_count
              preuve : docs qualité, API (`seedKeyword`, `keywords`)     confiance : high

Publication   id, article_id, integration_id, remote_id, remote_url,
              status, error, attempted_at
              preuve : F03, plugin (création / mise à jour à distance)  confiance : medium

SitePage      id, site_id, url, title, last_crawled_at
              (sert aux liens internes et à l'audit)
              preuve : liens internes « vers d'autres articles de votre site »  confiance : guess

AuditRun      id, site_id, started_at, finished_at, pages_crawled, score, status
              preuve : S15                                  confiance : medium

AuditIssue    id, audit_run_id, category (schema | meta | broken_link | alt_text |
              sitemap | speed | robots | headings), severity, page_url,
              message, recommendation, status (open | fixed)
              preuve : G2 (schema, meta, liens cassés, alt, sitemap, vitesse)  confiance : high

Subscription  id, workspace_id, plan (grow | scale), interval (month | year),
              status (trialing | active | past_due | canceled), trial_ends_at,
              articles_quota, languages_quota, stripe_customer_id
              preuve : tarifs, essai 3 jours                  confiance : high

ApiKey        id, workspace_id, hash, label, last_used_at
              preuve : S21, docs API                         confiance : medium

Job           id, kind (analyze_site | build_calendar | write_article |
              publish | audit | crawl), site_id, status, attempts, run_at, error
              preuve : publication quotidienne automatique   confiance : guess
```

Relations : User 1-n Workspace, Workspace 1-n Site, Site 1-n Competitor,
Site 1-n Integration, Site 1-n Keyword, Site 1-n CalendarItem,
CalendarItem 1-1 Article, Article 1-n Publication, Site 1-n AuditRun,
AuditRun 1-n AuditIssue, Workspace 1-1 Subscription.

## Matrice des fonctions

Voir `features.csv`. Must : 25, should : 16, could : 7, skip : 6.

## Hors périmètre (ne peut ou ne doit pas être cloné)

- **Le réseau d'échange de backlinks.** C'est leur réseau de membres, pas une
  fonction. Et l'échange de liens organisé est un « schéma de liens » au sens
  des règles anti-spam de Google : c'est un risque pour vos clients, pas un
  argument de vente.
- **Le suivi de visibilité dans les IA** (ChatGPT, Claude, Gemini, Perplexity) :
  exclu de ce périmètre par choix. Peut revenir plus tard.
- **Les leads Reddit / Quora et le contenu social** : hors périmètre.
- **Leurs données de mots-clés** : le volume et la difficulté viennent d'un
  fournisseur tiers payant. Il faut votre propre abonnement (ex. DataForSEO,
  Semrush API, Google Ads Keyword Planner).
- **Leurs plugins WordPress et Framer** : il faut écrire et publier les vôtres.
- **La garantie « 90 jours ou remboursé »** : décision commerciale, pas une
  fonction.

## Risques à garder en tête

- Google sanctionne le **contenu produit en masse** sans valeur ajoutée
  (« scaled content abuse »). Prévoir le mode brouillon et la relecture comme
  option mise en avant, pas cachée.
- Les avis signalent une **qualité inégale** dans les sujets techniques ou
  réglementés, et une **édition limitée**. C'est une piste pour faire mieux
  (`/replica-entrepreneur`).
- L'IA coûte à chaque article et à chaque régénération : il faut un quota.

## Taille

Écrans 23, parcours 9, entités 15.

Parties difficiles :
1. **Qualité des articles par IA** : plan, recherche, liens internes, schema,
   images, sans hallucinations ; coût maîtrisé par article.
2. **Intégrations CMS** : chacune a son API (WordPress demande un plugin,
   Shopify et Webflow ont OAuth et des limites de débit), avec des reprises
   et sans doublons.
3. **Exploration du site** pour l'audit et les liens internes : robots.txt,
   sitemaps, sites en JavaScript, limites de pages, mesure de vitesse
   (PageSpeed Insights API).

Aussi : tâches planifiées quotidiennes par fuseau horaire, données de
mots-clés (API payante), facturation au quota.

**Taille : L (un trimestre)** pour la boucle principale, l'audit, WordPress,
Webflow, Shopify et le webhook. Commencer par WordPress et le webhook seuls
ramène la première version à M (quelques semaines).
