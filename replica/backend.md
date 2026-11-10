# Backend d'Altiseo

État au 2026-11-09. Chaque service s'active dès que ses variables sont dans `.env.local`
(voir `.env.example`) ; sans elles, l'application reste en mode démo et le dit à l'écran.

## Ce qui est branché

| service | code | état |
| --- | --- | --- |
| Base de données | `supabase/migrations/`, `src/lib/data/supabase-store.ts` | **appliqué** sur le projet Supabase « altiseo » (eu-west-1) le 2026-11-09 : 2 migrations ; 10 vérifications locales ; contrôles Supabase propres (restent 4 avertissements voulus, voir plus bas) |
| Connexion | Supabase Auth, lien par e-mail, `src/app/auth/callback/route.ts`, `ensure_workspace()` | écrit ; à tester sur le projet |
| Rédaction | `src/lib/ai/claude.ts` : analyse du site, 30 sujets, articles | écrit, testé avec un faux client (7 tests) ; **pas encore appelé avec une vraie clé** |
| WordPress | `src/lib/cms/wordpress.ts` : API REST + mot de passe d'application | écrit, testé avec un faux serveur (4 tests) ; à tester sur un vrai site |
| Chiffrement | `src/lib/crypto.ts` (AES-256-GCM) | testé |
| Mots-clés | DataForSEO | à faire |
| Paiement | Stripe Checkout + portail + webhooks | à faire |
| E-mails | Resend (article prêt, échec, fin d'essai) | à faire ; les e-mails de connexion partent par Supabase |
| Tâches | file `jobs`, crons Vercel (publication quotidienne, lot de nuit) | à faire |

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
