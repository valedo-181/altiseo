# Altiseo

Des articles SEO écrits, planifiés et publiés pour vous : Altiseo analyse votre site, prépare un
mois de sujets avec leurs mots-clés, écrit un article par jour et le publie sur votre CMS
(WordPress, Webflow, Shopify, webhook), en brouillon à relire ou directement. Plus un audit SEO
technique du site.

État : **première version en mode démo**. Le parcours complet marche : inscription → site → 7 étapes
de configuration → calendrier de 30 sujets → écrire un article → le corriger → l'envoyer à WordPress.
En mode démo, les données sont dans `.data/demo.json`, les articles sont des **textes d'exemple
(sans IA)** et **rien n'est envoyé** à WordPress. Dès que les clés sont dans `.env.local`, la vraie base
(Supabase), la rédaction (Claude) et l'envoi à WordPress prennent le relais : voir `.env.example` et
`replica/backend.md` (mise en route pas à pas). Mots-clés (DataForSEO), paiement (Stripe), e-mails
(Resend) et publication quotidienne restent à faire.
Détail écran par écran : `replica/build-log.md`.

## Plans

| fichier | contenu |
| --- | --- |
| `replica/recon.md`, `replica/features.csv` | ce que fait le produit : écrans, parcours, 54 fonctions classées |
| `replica/architecture.md` | technique, rédaction par l'IA, API, ordre de construction |
| `supabase/migrations/` | base de données (18 tables, RLS), testée par `npm run test:db` |
| `replica/backend.md` | services branchés, mise en route, liste de sécurité |
| `replica/design/` | jetons, composants (`components.md`) |
| `replica/brand.md` | nom, couleurs, logo, ton |

## Lancer

```bash
npm install
npm run dev          # http://localhost:3000, système de design sur /design
npm run typecheck
npm test             # logique métier (URL, dates, calendrier, Markdown sûr, article)
npm run tokens       # après une modification de replica/design/tokens.json
npm run test:db      # schéma + RLS sur un Postgres 16 local (initdb, pg_ctl, psql ; pas en root)
```

## Technique

Next.js 15 (App Router) + TypeScript + Tailwind CSS 3. Couleurs, tailles et rayons uniquement par
les jetons : `replica/design/tokens.json` → `src/styles/tokens.css` + `tailwind.preset.ts`
(`npm run tokens`), mode clair et sombre. Polices Unbounded, Instrument Sans et Source Serif 4 (licence OFL), icônes
Lucide (ISC).

## Vérifier le parcours complet

```bash
npm run build
ALTISEO_DEMO=1 ALTISEO_DEMO_FILE=/tmp/altiseo-demo.json npx next start -p 3100 &
node scripts/slice-check.cjs       # 35 contrôles dans un vrai navigateur (Playwright)
```

`ALTISEO_DEMO=1` autorise le mode démo en production locale ; en vrai déploiement il faut
`ALTISEO_SESSION_SECRET` (32 caractères au moins).
