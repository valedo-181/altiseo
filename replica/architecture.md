# Architecture : blog SEO automatique (reconstruction des fonctions de base de Babylovegrowth)

Nom provisoire : le nom et la marque viennent avec `/replica-brand`.
Lu : `replica/recon.md`, `replica/features.csv` (périmètre : boucle principale + audit technique).
Date : 2026-11-06

## Où vit le code

**Un nouveau dépôt**, pas Titanor : c'est un produit séparé, avec ses propres clients, sa propre
base et sa propre facturation. Il faut le créer sur GitHub et l'ajouter à la session (je ne peux pas
créer de dépôt d'ici). En attendant, ce dossier `replica/` sert de cahier de plans.

On reprend **votre propre code** de Titanor quand il fait déjà le travail :

| dans Titanor | ce qu'il fait | reprise |
| --- | --- | --- |
| `src/lib/seo/crawl.ts` | lecture sûre d'un site (adresses publiques seulement, redirections revérifiées, robots.txt, sitemap, 1,5 Mo par page), PageSpeed | copiée telle quelle |
| `src/lib/seo/audit.ts` | 15 contrôles, poids, note sur 100, fonctions pures testées | copiée, sans les contrôles propres aux sociétés locales (téléphone, adresse, LocalBusiness) qui deviennent facultatifs |
| `src/lib/seo/keywords.ts`, appels DataForSEO de `run.ts` | mots-clés et positions via DataForSEO | le client DataForSEO ; la logique « métiers × villes » est remplacée |
| `src/lib/billing/*`, webhooks Stripe | essai, offres, portail client | même façon de faire, offres différentes |
| `supabase/tests/run.sh` + stub | tests SQL sur un Postgres jetable | repris (voir `replica/tests/`) |
| shell, composants `ui.tsx`, next-intl | coquille de l'app | point de départ, retouché par `/replica-design` |

## Stack

Même socle que Titanor : vous le connaissez déjà et il tourne en production.

| couche | choix | pourquoi |
| --- | --- | --- |
| web | Next.js 15 (App Router, actions serveur) + TypeScript | votre stack actuelle ; une seule app pour le site, le tableau de bord et l'API |
| style | Tailwind, jetons de `/replica-design` | comme Titanor |
| langues | next-intl (FR d'abord, EN, DE) | déjà utilisé ; l'interface et les articles sont multilingues |
| base | Postgres sur Supabase, région Central EU (Frankfurt) | RLS pour isoler chaque espace ; données en Europe pour le RGPD |
| accès SQL | client Supabase + SQL dans les migrations | comme Titanor, pas d'ORM à apprendre |
| auth | Supabase Auth : e-mail vérifié, lien magique, Google | une ligne de config pour Google ; même flux que Titanor |
| paiements | Stripe Checkout + Billing + portail client | essai de 3 jours, mensuel / annuel, annulation en un clic |
| e-mails | Resend | comme Titanor : article prêt, échec de publication, fin d'essai |
| rédaction IA | API Claude, `claude-opus-5-5`, Batch API la nuit | voir « Rédaction » plus bas |
| mots-clés | DataForSEO (Labs : idées, volume, difficulté, mots-clés des concurrents) | déjà branché dans Titanor, payé à l'usage |
| vitesse | PageSpeed Insights API | gratuit, déjà branché |
| images | à trancher à `/replica-backend` : banque d'images avec licence (crédit obligatoire) ou génération d'images (payant) | Claude ne produit pas d'images |
| fichiers | Supabase Storage (images à la une) | même projet que la base |
| tâches | file `jobs` dans Postgres + Vercel Cron qui la vide | pas de service de plus ; reprises et anti-doublon dans la base |
| hébergement | Vercel, région `dub1` (comme Titanor) | proche de Frankfurt ; crons intégrés |

**Vercel Pro est nécessaire** : le cron toutes les minutes et les fonctions de 5 minutes (rédaction
d'un article à la demande) ne passent pas sur l'offre gratuite.

## Rédaction (le cœur du produit)

Trois appels à Claude, tous en `claude-opus-5-5` avec réflexion adaptative et sorties structurées
(`output_config.format`, schéma JSON validé) :

| étape | entrée | sortie | effort |
| --- | --- | --- | --- |
| analyse du site (F01) | 10–20 pages lues par `crawl.ts` | activité, public, ton, 3–5 concurrents (outil `web_search` pour les trouver) | `medium` |
| calendrier (F01, F02) | profil + mots-clés DataForSEO du site et des concurrents + pages existantes | 30 sujets : titre, angle, mot-clé principal, sans doublon avec les pages déjà en ligne | `medium` |
| article (F03) | profil + instructions perso + liste des pages du site (pour les liens) + sujet | titre, slug, méta, corps HTML, FAQ, liens internes choisis dans la liste, JSON-LD | `medium`, à mesurer |

- **Préfixe en cache** : profil de marque, instructions et liste des pages forment un préfixe stable
  (`cache_control`), réutilisé pour les 30 articles du mois.
- **Batch API la nuit** : les articles du lendemain partent en lot vers 22 h (UTC), à -50 %, et
  reviennent bien avant l'heure de publication. Un article demandé à la main (« régénérer »)
  passe en appel direct, en streaming.
- **Refus** : en appel direct, le paramètre `fallbacks: "default"` (bêta
  `server-side-fallback-2026-07-01`) relance la demande sur un autre modèle si elle est refusée.
  La Batch API ne l'accepte pas : un article refusé dans le lot est relancé en appel direct.
- **Garde-fous** : les liens internes sont vérifiés contre `site_pages` (aucun lien inventé), le HTML
  passe par une liste blanche de balises avant d'être stocké, la longueur est contrôlée.

**Coût estimé** (à mesurer sur de vrais articles) : ~12 000 jetons en entrée et ~6 000 en sortie
par article, soit environ 0,17 $ en direct et 0,09 $ en lot (prix de l'API : 4 $ / 20 $ le million
de jetons). Pour 30 articles : **3 à 5 $ par client et par mois**, plus quelques centimes de
DataForSEO. Le modèle reste `claude-opus-5-5` ; passer à un modèle moins cher est une décision à
prendre après mesure de la qualité.

## Schéma

Tables : 18. Accès : **Row Level Security** sur toutes les tables, comme Titanor. Chaque table métier
porte `workspace_id` ; `is_member()` / `is_admin()` décident. Le SQL complet est dans
`replica/schema.sql`, testé par `replica/tests/run.sh` (8 vérifications).

| table | rôle | écrit par |
| --- | --- | --- |
| `workspaces`, `memberships` | espaces et membres (propriétaire, admin, membre) | l'utilisateur |
| `plans`, `subscriptions`, `stripe_events` | offres, abonnement par espace, webhooks traités une fois | webhooks Stripe |
| `sites`, `competitors` | site, profil de marque, réglages, planning ; concurrents | l'utilisateur |
| `integrations` (+ vue `integrations_public`) | CMS connecté, identifiants chiffrés | actions serveur |
| `site_pages` | pages explorées (liens internes, audit) | tâches |
| `keywords`, `calendar_items` | mots-clés ; un sujet par jour et par site | tâches ; l'utilisateur valide |
| `articles`, `publications` | articles ; un billet CMS par article | tâches ; l'utilisateur corrige |
| `audit_runs`, `audit_issues` | audits et problèmes | tâches |
| `api_keys` | clés de l'API publique (hachées) | l'admin |
| `jobs`, `ai_batches` | file de tâches, lots Claude | serveur seulement |

Les règles dures sont dans la base, pas dans l'écran :

- **un sujet par jour et par site** : `unique (site_id, scheduled_for)` ;
- **un article par sujet** : `calendar_item_id unique` ;
- **jamais deux billets pour un article** : `unique (article_id, integration_id)` + `remote_id`
  (republier met à jour le billet existant) ;
- **le quota d'articles** : un déclencheur verrouille l'abonnement et refuse le 31e article de
  la période, même si deux tâches tournent en même temps ;
- **une tâche une seule fois** : `jobs.dedupe_key unique` (ex. `write_article:<id>`) ;
- **un audit à la fois par site** : index unique partiel ;
- **pas de mélange entre espaces** : un déclencheur refuse de rattacher une ligne au site d'un
  autre espace ;
- **les identifiants CMS ne sortent jamais vers le navigateur** : colonne retirée des droits du
  rôle `authenticated`, lecture par la vue `integrations_public` ;
- **les articles et l'abonnement ne s'écrivent pas depuis le navigateur** : seuls la rédaction et
  les webhooks Stripe (clé `service_role`, côté serveur) le font.

Les tâches de fond utilisent la clé `service_role` dans les routes cron uniquement (jamais dans le
navigateur). C'est plus simple que les fonctions `cron_*` de Titanor, qui restent possibles si vous
voulez garder ce modèle.

## API

Actions serveur (formulaires de l'app) et routes. « membre » = membre de l'espace, vérifié par RLS.

| méthode chemin | fait | qui | entrée | sortie | parcours |
| --- | --- | --- | --- | --- | --- |
| Supabase `signUp` / `signInWithOtp` / OAuth Google | inscription, connexion | tous | e-mail, mot de passe | session | F01 |
| GET `/auth/confirm` | confirme l'e-mail | tous | jeton | redirection | F01 |
| action `createWorkspace` | crée l'espace, propriétaire | connecté | nom | `workspace_id` | F01 |
| action `createSite` | crée le site, file `analyze_site` | membre | URL | `site_id` | F01, F09 |
| action `saveSiteProfile` | activité, public, langue, ton | membre | champs S05, S07 | site | F01 |
| action `saveCompetitors` | concurrents | membre | liste d'URL | liste | F01 |
| action `detectCms` | devine le CMS depuis le domaine | membre | `site_id` | type probable | F01 |
| action `saveSchedule` | heure, fuseau, jours, brouillon ou publication | membre | champs S09, S20 | site | F01 |
| POST `/api/billing/checkout` | session Stripe Checkout avec essai | admin | offre, intervalle | URL Stripe | F01 |
| POST `/api/billing/portal` | portail Stripe (changer, annuler) | admin | — | URL Stripe | F08 |
| POST `/api/webhooks/stripe` | met à jour `subscriptions` | Stripe (signature) | événement | 200 | F01, F08 |
| action `buildCalendar` | file `fetch_keywords` puis `build_calendar` | membre | `site_id` | — | F01 |
| action `approveItems` | approuve un ou tous les sujets | membre | ids | sujets | F02 |
| action `regenerateItem` | nouveau sujet pour ce jour (5 fois au plus) | membre | id | sujet | F02 |
| action `skipItem` / `addItem` | saute un jour / ajoute un sujet à la main | membre | id ou titre + date | sujet | F02 |
| action `updateArticle` | corrige titre, méta, corps | membre | champs S14 | article | F04 |
| action `publishArticle` | file `publish` (création ou mise à jour) | membre | id | statut | F04 |
| action `regenerateArticle` | réécrit (consomme le quota) | membre | id, consigne | article | F04 |
| action `archiveArticle` | retire de la liste | admin | id | — | F04 |
| action `connectIntegration` | chiffre et enregistre les identifiants, teste | admin | type, identifiants | statut | F05 |
| GET `/api/oauth/[provider]/callback` | retour OAuth (Webflow, Shopify, Wix) | fournisseur | code, state | redirection | F05 |
| action `testIntegration` | crée puis supprime un brouillon de test | admin | id | ok / erreur lisible | F05 |
| action `disconnectIntegration` | désactive, efface les identifiants | admin | id | — | F05 |
| action `startAudit` | file `crawl` + `audit` | membre | `site_id` | `audit_run_id` | F06 |
| action `saveWritingSettings` / `saveVisualSettings` | instructions, concurrents, longueur, images | membre | champs S18, S19 | site | F07 |
| action `createApiKey` / `revokeApiKey` | clé montrée une seule fois, stockée hachée | admin | libellé / id | clé / — | — |
| GET `/api/v1/articles` | liste des articles publiés | clé API | `site`, `since`, `page` | JSON | — |
| GET `/api/v1/articles/:id` | un article | clé API | id | JSON | — |
| GET `/api/cron/schedule` | toutes les 15 min : crée les tâches `write_article` / `publish` dues, à l'heure locale de chaque site | Vercel Cron (secret) | — | nombres | F03 |
| GET `/api/cron/worker` | chaque minute : prend les tâches dues (`for update skip locked`), 4 min au plus | Vercel Cron (secret) | — | nombres | toutes |
| GET `/api/cron/batches` | toutes les 15 min : envoie le lot du lendemain, récupère les lots finis | Vercel Cron (secret) | — | nombres | F03 |
| GET `/api/cron/maintenance` | chaque nuit : réexplore les sites, audit mensuel, purge des tâches finies | Vercel Cron (secret) | — | nombres | F06 |

Total : 32 routes et actions.

**Webhooks entrants** : Stripe (`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`), retours OAuth des CMS.

**Webhooks sortants** : intégration « webhook » : `POST` JSON de l'article vers l'URL du client,
signé HMAC-SHA256 (`X-Signature`), avec un identifiant d'envoi pour que le client ignore les
doublons ; 5 essais avec délai croissant.

**Publication par CMS** (API officielles, avec les identifiants du client) :

| CMS | méthode | priorité |
| --- | --- | --- |
| WordPress | API REST de WordPress + mot de passe d'application (intégré depuis WordPress 5.6, **pas de plugin à écrire**) | must |
| webhook | voir ci-dessus | must |
| Webflow | Data API v2, collection CMS, OAuth | should |
| Shopify | Admin API (blogs, articles), application du client ou OAuth | should |
| Ghost | Admin API (clé Admin, jeton JWT) | could |
| Wix | API Blog, OAuth | could |
| Framer | plugin Framer à écrire et faire valider | could |

**Tâches** (`jobs.kind`) : `analyze_site`, `fetch_keywords`, `build_calendar`, `write_article`,
`publish`, `crawl`, `audit`. Chacune avec `dedupe_key`, 5 essais au plus, délai croissant, puis
`dead` et un e-mail à l'espace si c'est une publication.

## Les parties qui mordent

- **Fuseaux horaires** : `scheduled_for` est le jour *local* du site ; l'heure de publication est
  calculée dans son fuseau (`Europe/Zurich`…) à chaque passage du cron, pas stockée en UTC une fois
  pour toutes : le changement d'heure ne décale rien.
- **Doublons** : Stripe renvoie parfois deux fois (`stripe_events`) ; une tâche relancée ne recrée
  pas d'article (`calendar_item_id unique`) ni de billet (`remote_id`, `unique`).
- **Courses** : quota verrouillé dans la base ; tâches prises avec `for update skip locked` et
  `locked_until` (une tâche plantée est reprise après expiration).
- **Limites de débit** : Claude (429, attendre `retry-after`), DataForSEO, Webflow (60 req/min),
  Shopify (seau qui fuit) : délai croissant par intégration, pas de boucle serrée.
- **Durée des fonctions** : rédaction directe en streaming dans une fonction de 5 min ; le reste en
  lot de nuit. Aucune tâche ne dépend d'une page ouverte.
- **Sécurité de l'exploration** : les URL viennent des clients : seul `safeFetch` de `crawl.ts`
  (adresses publiques, pas de 127.0.0.1 ni de métadonnées cloud) a le droit de les lire.
- **HTML produit par l'IA** : nettoyé par liste blanche avant stockage, et encore avant affichage
  dans l'éditeur (pas de `<script>`, pas d'attributs `on*`).
- **Identifiants CMS** : chiffrés en AES-256-GCM avec `ENCRYPTION_KEY` (variable du serveur),
  jamais renvoyés au navigateur, effacés à la déconnexion.
- **Coûts** : quota par période, 5 régénérations par sujet, coût de chaque article enregistré
  (`ai_cost_micro_usd`) pour suivre la marge.
- **Qualité et règles de Google** : Google sanctionne le contenu produit en masse sans valeur
  ajoutée. Le mode **brouillon** est le réglage par défaut (`publish_mode = 'draft'`) et la relecture
  est mise en avant.
- **Plusieurs clients** : RLS partout, testé avec un second utilisateur qui ne voit rien.
- **RGPD** : données en Europe ; supprimer l'espace efface tout en cascade ; sous-traitants à
  déclarer : Supabase, Vercel, Stripe, Resend, Anthropic, DataForSEO, Google (PageSpeed).
- **E-mails** : domaine d'envoi vérifié chez Resend (SPF, DKIM).
- Pas de temps réel ni de hors-ligne : l'écran relit le statut des tâches toutes les quelques
  secondes pendant une analyse ou une rédaction.

## Ordre de construction

**1. Tranche verticale** : la boucle complète, sans finition.
Inscription → espace → URL du site → analyse simple → calendrier de 30 sujets (sans DataForSEO,
volume vide) → rédaction d'**un** article en direct → lecture dans l'app → publication en
**brouillon sur WordPress**.
Écrans S03, S04, S05, S12, S13, S14, S17. Tables `workspaces`, `memberships`, `sites`,
`calendar_items`, `articles`, `integrations`, `publications`, `jobs`. Routes `createWorkspace`,
`createSite`, `buildCalendar`, `regenerateArticle`, `connectIntegration`, `publishArticle`,
`/api/cron/worker`.

**2. Indispensables** (`must` de `features.csv`), par domaine :
- onboarding complet en 7 étapes (S04–S10), concurrents, langue, planning ;
- Stripe : essai de 3 jours, abonnement mensuel / annuel, quota (`subscriptions`, `plans`,
  webhooks) ;
- mots-clés DataForSEO avec volume et difficulté, approuver / régénérer (S12) ;
- article quotidien automatique : `/api/cron/schedule`, lot de nuit (`/api/cron/batches`),
  reprises ;
- liens internes (exploration `site_pages`), instructions perso, mode brouillon ;
- webhook sortant signé, test de connexion avec erreur lisible ;
- audit technique : contrôles de `audit.ts`, note, problèmes par gravité (S15).

**3. Importants, puis secondaires** :
- *should* : connexion Google, ton, détection du CMS, « articles recommandés », JSON-LD, image à
  la une, option concurrents, édition + republication, API publique (S21), Webflow, Shopify,
  vitesse PageSpeed, recommandations (S16), tableau de bord (S11), portail Stripe.
- *could* : Framer, Wix, Ghost, vidéo, sujet ajouté à la main, suivi des corrections d'audit,
  plusieurs sites par espace (S23).

**4. Corrections de `/replica-entrepreneur`** : les points faibles relevés dans les avis (édition
limitée, qualité inégale dans les sujets techniques, risques des échanges de liens) deviennent des
arguments. À lancer après `/replica-diff`.
