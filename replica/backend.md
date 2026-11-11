# Backend d'Altiseo

État au 2026-11-09. Chaque service s'active dès que ses variables sont dans `.env.local`
(voir `.env.example`) ; sans elles, l'application reste en mode démo et le dit à l'écran.

## Ce qui est branché

| service | code | état |
| --- | --- | --- |
| Base de données | `supabase/migrations/`, `src/lib/data/supabase-store.ts` | **appliqué** sur le projet Supabase « altiseo » (eu-west-1) le 2026-11-09 : 2 migrations ; 10 vérifications locales ; contrôles Supabase propres (restent 4 avertissements voulus, voir plus bas) |
| Connexion | Supabase Auth, lien par e-mail, `src/app/auth/callback/route.ts`, `ensure_workspace()` | écrit ; à tester sur le projet |
| Rédaction | `src/lib/ai/claude.ts` : analyse du site, 30 sujets, articles | écrit, testé avec un faux client (7 tests) ; **pas encore appelé avec une vraie clé** |
| Site statique (GitHub) | `src/lib/cms/github.ts` : API contents de GitHub + jeton fine-grained (dépôt unique, « Contents : Read and write »), chiffré comme le mot de passe WordPress ; écrit `blog/articles/<slug>.json` + `blog/img/<slug>.jpg`, le site en fait la page (ex. `outils/blog.mjs` de domevia.ch, lancé par Vercel) | écrit, testé avec un faux GitHub (7 tests) ; migration `20261114000000_integration_github` à appliquer |
| WordPress | `src/lib/cms/wordpress.ts` : API REST + mot de passe d'application | écrit, testé avec un faux serveur (4 tests) ; à tester sur un vrai site |
| Chiffrement | `src/lib/crypto.ts` (AES-256-GCM) | testé |
| Audit SEO | `src/lib/seo/` (lecture du site, 15 contrôles, PageSpeed), `runAudit` | écrit, calcul testé (3 tests) ; lecture d'un vrai site pas encore essayée en ligne |
| Mots-clés | DataForSEO | à faire |
| Paiement | Stripe Checkout + portail + webhooks | à faire |
| E-mails | Resend (article prêt, échec, fin d'essai) | à faire ; les e-mails de connexion partent par Supabase |
| Tâches | file `jobs`, crons Vercel (publication quotidienne, lot de nuit) | fait : passage quotidien (`/api/cron/daily`) ; file `jobs` non utilisée |

## Mise en route (à faire par vous)

1. ~~**Supabase** : projet créé (« altiseo », eu-west-1).~~ Copier l'URL, la clé `anon` et la clé
   `service_role` (Project Settings → API) dans `.env.local` et dans Vercel.
2. ~~**Schéma** : les deux fichiers de `supabase/migrations/` sont appliqués.~~
3. **Connexion** : Authentication → URL Configuration → *Site URL* = l'adresse de l'app ;
   *Redirect URLs* : `<adresse>/auth/callback`. Les liens de connexion arrivent par l'e-mail de Supabase
   (limité à quelques envois par heure : brancher un SMTP, par exemple Resend, avant d'ouvrir au public).
4. **Claude** : créer une clé sur console.anthropic.com, la mettre dans `ANTHROPIC_API_KEY`,
   fixer une limite de dépense mensuelle dans la console.
5. **Chiffrement** : `openssl rand -base64 32` → `ENCRYPTION_KEY`.
6. **WordPress de test** : un site WordPress (même gratuit), un compte « Auteur », un mot de passe
   d'application (Profil → Mots de passe d'application).

## Rédaction par Claude

- Modèle `claude-opus-5-5`, réflexion adaptative, effort `medium`, sorties structurées (Zod).
- `fallbacks: "default"` (bêta `server-side-fallback-2026-07-01`) : une demande refusée par les
  garde-fous est relancée d'elle-même sur un autre modèle ; si elle reste refusée, message clair.
- Profil de l'entreprise et liste des pages en cache (`cache_control`) : moins cher d'un article à l'autre.
- Rien d'inventé : le prompt interdit chiffres, prix, témoignages non fournis ; le contenu des sites
  lus est traité comme une donnée, pas comme des consignes.
- Liens internes revérifiés après coup : seules les pages connues du site restent cliquables.
- Coût de chaque article enregistré (`ai_cost_micro_usd`) ; quota vérifié avant l'appel.
- Pas encore : lot de nuit (Batch API, −50 %), volume et difficulté des mots-clés (DataForSEO).

## Liste de sécurité

- [x] secrets dans les variables d'environnement seulement, `.env*` ignoré par git, rien côté navigateur
      (clés service_role et Claude sans `NEXT_PUBLIC_`, modules `server-only`)
- [x] saisies vérifiées côté serveur dans chaque action (adresse, e-mail, longueurs, heure, fuseau, slug)
- [x] droits vérifiés à chaque lecture et écriture : RLS dans la base, vérification du site avant toute
      écriture en service_role ; testé avec un second compte (base) et dans le parcours (démo)
- [ ] limites de fréquence : celles de Supabase Auth pour les liens de connexion ; à ajouter sur les
      actions qui appellent l'IA (en plus du quota et des 5 régénérations)
- [ ] webhooks signés : à faire avec Stripe
- [x] pas de fichier envoyé par les clients pour l'instant
- [x] pas de données personnelles dans les adresses ni dans les journaux
- [x] dépendances auditées (`npm audit --omit=dev`) : 0 vulnérabilité (PostCSS de Next forcé en version corrigée)
- [ ] politique de confidentialité listant les sous-traitants : Supabase, Vercel, Anthropic, Stripe,
      Resend, DataForSEO, Google (PageSpeed)
- [x] identifiants WordPress chiffrés (AES-256-GCM), jamais renvoyés au navigateur ni écrits dans les erreurs
- [x] appels sortants (lecture du site, WordPress) limités aux adresses publiques, sans redirection
      suivie pour WordPress, avec délai maximal
- [x] HTML des articles produit par un convertisseur qui échappe tout (pas d'injection de script)

## Contrôles Supabase (security advisor) : avertissements voulus

- `articles_left`, `is_member`, `is_admin`, `ensure_workspace` sont exécutables par les comptes connectés :
  c'est nécessaire (règles RLS et premier accès) et chacune vérifie elle-même l'appartenance à l'espace
  ou n'agit que sur le compte connecté.
- `jobs`, `stripe_events`, `ai_batches` ont la RLS sans aucune règle : volontaire, seul le serveur y accède.

## Console super admin (`/admin`)

- Accès : compte listé dans `platform_admins` + double authentification (TOTP, session `aal2`). Un compte
  non listé reçoit « page introuvable ». La base revérifie à chaque appel (fonctions `admin_*`).
- Écrans : clients (revenu, essais, santé, filtres), fiche client (prolonger l'essai, changer d'offre,
  suspendre / réactiver), coûts IA et marge, suivi technique (échecs, relance), journal.
- Un client suspendu perd l'accès (RLS) et voit `/suspendu` avec la raison.
- Ajouter un administrateur (SQL Editor) :
  `insert into public.platform_admins (user_id) select id from auth.users where email = '…';`
- Supabase : Authentication → Sign In / Providers → Multi-Factor → TOTP doit être activé.
- Testé : 6 vérifications SQL (`replica/tests/admin_test.sql`), 5 tests des calculs. Les écrans n'ont pas
  encore été essayés sur le vrai projet (il faut un compte admin connecté).

## À faire

- [ ] **Brancher Higgsfield (images des articles).** En attente : créer une clé API dans la console Higgsfield,
      recharger le solde API (à part de l'abonnement), mettre `HIGGSFIELD_KEY_ID` et `HIGGSFIELD_KEY_SECRET` dans
      Vercel, redéployer, puis faire un premier essai réel (jamais testé contre la vraie API).
- [ ] **Activer la publication automatique.** En attente : `CRON_SECRET` dans Vercel, puis redéployer.
- [ ] **Brancher le vrai Google (Search Console).** En attente. Google Cloud : projet, activer
      « Google Search Console API », écran de consentement OAuth, ID client « Application Web » avec la
      redirection `https://altiseo-hazel.vercel.app/app/mots-cles/google/callback`. Vercel :
      `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`, puis redéployer. Ensuite : tester la
      première connexion réelle, et demander la validation de Google avant d'ouvrir au public.
- [ ] **Resend (e-mails).** En attente du choix de l'adresse d'expédition : `titanor.app` (déjà vérifié,
      provisoire), `domevia.ch` ou un domaine Altiseo (3 lignes DNS à poser). Ensuite :
      1. Supabase → Authentication → Emails → SMTP Settings : hôte `smtp.resend.com`, port 465,
         utilisateur `resend`, mot de passe = une clé API Resend. Lève la limite de 2 e-mails par heure
         du service intégré, qui bloque les connexions dès le troisième essai.
      2. `RESEND_API_KEY` et `MAIL_FROM` dans Vercel, puis les e-mails de l'app : article prêt à relire,
         échec d'envoi au site, fin d'essai.
- [ ] Clé Claude (`ANTHROPIC_API_KEY`) et `ENCRYPTION_KEY` dans Vercel.
- [ ] Domaine définitif à la place de `altiseo-hazel.vercel.app`.
- [ ] Essayer la console `/admin` sur le vrai site (QR code de double authentification).


## Suivi des mots-clés (Google Search Console)

Page `/app/mots-cles` (S24). Source : l'API officielle de Search Console, en lecture seule
(portée `webmasters.readonly`). Code : `src/lib/search/` (`google.ts`, `report.ts`), service dans
`src/lib/app/service.ts`, table `search_connections` (migration `20261111000000_search_console.sql`).

- Connexion : `/app/mots-cles/google/connect` → accord chez Google → `/app/mots-cles/google/callback`.
  Secret à usage unique dans un cookie (anti-CSRF). La propriété Search Console du site est choisie
  toute seule (domaine entier d'abord) ; aucune propriété correspondante = connexion refusée et accès retiré.
- Le jeton de renouvellement est chiffré (AES-256-GCM, `ENCRYPTION_KEY`), illisible côté navigateur
  (droits par colonne, testé dans `replica/tests/search_test.sql`). Déconnexion = accès retiré chez Google + ligne effacée.
- Rapport : 90 jours de totaux par jour, 28 derniers jours contre les 28 d'avant, 200 recherches au plus.
  Relu au plus une fois par 24 h à l'ouverture de la page, ou par le bouton « Actualiser ».
- Sans `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` : chiffres d'exemple, annoncés comme tels.

À faire côté Google Cloud : créer un projet, activer « Google Search Console API », écran de
consentement OAuth (portée `webmasters.readonly`, portée « sensible » : validation par Google à demander
avant d'ouvrir au public, sinon écran « application non validée » et 100 comptes de test au plus),
ID client OAuth « Application Web » avec l'URI `https://<domaine>/app/mots-cles/google/callback`.
Pas encore testé contre le vrai Google (réseau fermé depuis l'environnement de développement).


## Publication automatique (tâche quotidienne)

`GET /api/cron/daily`, appelée par Vercel Cron (`vercel.json`, 04:00 UTC) avec `Authorization: Bearer $CRON_SECRET`.
Code : `src/lib/jobs/` (`select.ts` pur et testé, `daily.ts`), fonction SQL `automation_due()` (service_role seulement).

- Pour chaque sujet **approuvé** dont le jour est arrivé (fuseau du site) : réservation du sujet, écriture
  de l'article (Claude), puis envoi au site si une intégration est connectée (brouillon ou publié selon le
  réglage). Sans intégration : l'article reste en brouillon dans Altiseo.
- Écartés : espace suspendu, essai terminé, abonnement inactif, site encore en onboarding, quota atteint,
  sujet vieux de plus de deux jours. Un échec d'écriture est repris au passage suivant.
- Pas de session : `runAsSystem()` (src/lib/supabase/server.ts) fait travailler la couche de données en
  service_role, uniquement dans cette tâche et avec des identifiants lus dans la base.
- Limites : trois articles en parallèle, plus de nouvel article après 2 minutes ; le reste est reporté
  (`postponed`). Avec un seul passage par jour, cela couvre une poignée de sites. Au-delà : passage
  horaire (Vercel Pro, `CRON_MODE=hourly`, respecte alors l'heure de publication du site) ou file de tâches.
- Un envoi WordPress raté n'est pas retenté tout seul : l'erreur se voit sur l'article, bouton « Envoyer ».
- Pas encore : e-mail « article prêt » (attend Resend), journal des passages dans la console admin.

## Image des articles (Higgsfield)

Chaque article reçoit une photo réaliste 16:9 (réglage du site « Créer une image pour chaque article », actif par défaut).
Code : `src/lib/images/` (`prompt.ts`, `higgsfield.ts`), `illustrateArticle` dans `src/lib/app/service.ts`,
migration `20261113000000_images_articles.sql`, stockage public Supabase `article-images` (écrit par le serveur seulement).

- La rédaction (Claude) propose la scène à photographier ; un style fixe est ajouté : photo réaliste, sans texte,
  sans logo, sans visage reconnaissable. Sans scène proposée : on part du titre et du thème.
- API Higgsfield : dépôt sur `https://api.higgsfield.ai/<modèle>`, suivi de l'état, téléchargement (10 Mo au plus,
  JPEG / PNG / WebP, adresse publique seulement). Clé : la console donne une seule valeur « identifiant:secret », à coller
  entière dans `HIGGSFIELD_KEY_ID` (les deux moitiés séparées, avec `HIGGSFIELD_KEY_SECRET`, marchent aussi). Adresse et identification vérifiées sur le client
  officiel `higgsfield-client` (Python). Modèle par défaut `z-image/turbo`, changeable par
  `HIGGSFIELD_IMAGE_MODEL`. **Écrit d'après des extraits de la documentation (site inaccessible depuis
  l'environnement de développement) et jamais testé contre la vraie API** : prévoir un essai réel et un ajustement
  possible des paramètres (`aspect_ratio`, `resolution`) selon le modèle.
- Une image qui échoue ne bloque jamais l'article : bouton « Créer une image » sur la fiche. Cinq créations au plus par article.
- WordPress : l'image est déposée dans la médiathèque avec son texte de remplacement et devient l'image mise en
  avant ; renvoyée seulement si elle a changé, retirée si l'article n'en a plus. Seules les adresses de notre
  stockage sont acceptées (un membre peut modifier `image_url` dans la base : `isOwnImage`).
- Sans `HIGGSFIELD_KEY_ID` / `HIGGSFIELD_KEY_SECRET` : image d'exemple, annoncée comme telle, jamais envoyée au site.
- Pas encore : coût des images dans la console admin (tarif à confirmer), choix du style par client.
