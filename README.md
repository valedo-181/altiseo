# Altiseo

Des articles SEO écrits, planifiés et publiés pour vous : Altiseo analyse votre site, prépare un
mois de sujets avec leurs mots-clés, écrit un article par jour et le publie sur votre CMS
(WordPress, Webflow, Shopify, webhook), en brouillon à relire ou directement. Plus un audit SEO
technique du site.

État : **système de design** en place (`/design`). L'application elle-même vient ensuite.

## Plans

| fichier | contenu |
| --- | --- |
| `replica/recon.md`, `replica/features.csv` | ce que fait le produit : écrans, parcours, 54 fonctions classées |
| `replica/architecture.md` | technique, rédaction par l'IA, API, ordre de construction |
| `replica/schema.sql` | base de données (18 tables, RLS), testée par `npm run test:db` |
| `replica/design/` | jetons, composants (`components.md`) |
| `replica/brand.md` | nom, couleurs, logo, ton |

## Lancer

```bash
npm install
npm run dev          # http://localhost:3000, système de design sur /design
npm run typecheck
npm run tokens       # après une modification de replica/design/tokens.json
npm run test:db      # schéma + RLS sur un Postgres 16 local (initdb, pg_ctl, psql ; pas en root)
```

## Technique

Next.js 15 (App Router) + TypeScript + Tailwind CSS 3. Couleurs, tailles et rayons uniquement par
les jetons : `replica/design/tokens.json` → `src/styles/tokens.css` + `tailwind.preset.ts`
(`npm run tokens`), mode clair et sombre. Polices Inter et Source Serif 4 (licence OFL), icônes
Lucide (ISC).
