# Altiseo : la marque

Nom : **Altiseo** (altitude + SEO : faire monter votre site). Choisi le 2026-11-07.

## Vérifications du nom (à faire, non faites)

Le réseau de la session de travail bloquait ces sites : rien n'a été vérifié. Écrire la date et
le résultat de chaque vérification ici.

| vérification | où | résultat |
| --- | --- | --- |
| marque suisse | swissreg.ch, classes 9 et 42 | à faire |
| marque UE | euipo.europa.eu (eSearch) ou TMview | à faire |
| monde | WIPO Global Brand Database | à faire |
| domaines | altiseo.ch, altiseo.com | à faire |
| recherche web | « altiseo » + SEO / agence / logiciel | à faire |
| réseaux | LinkedIn, Instagram, X, GitHub | à faire |

Ce ne sont que des vérifications de base, pas un avis juridique : faire faire une recherche de marque
par un spécialiste avant d'investir. Ne pas utiliser « Swiss », « Suisse », « Helvetia » ni la croix
suisse dans la marque sans vérifier les règles « Swissness ».

## Charte « courbes de niveau » (choisie le 2026-11-11, direction D)

Planches des propositions : `replica/brand/propositions.png` (A, B, C) et `replica/brand/melanges.png` (D, E).

### Logo

`src/components/brand/logo.tsx`, icône d'onglet `src/app/icon.svg`, fichier source `replica/brand/altiseo-D.svg`.

- **Symbole** : dans un carré arrondi nuit glaciaire, trois lignes de carte topographique emboîtées
  dessinent un sommet et la lettre A ; un point corail marque le sommet atteint.
- **Nom** : « altiseo » en minuscules, Unbounded 500, d'une seule couleur.
- Le symbole garde les mêmes couleurs en mode clair et en mode sombre.
- Taille minimale : 16 px pour le symbole seul. Marge libre autour : la moitié de sa largeur.
- À ne pas faire : changer les couleurs, déformer, mettre le symbole sur une photo chargée,
  écrire le nom dans une autre police.
- C'est une proposition de travail : un graphiste peut la finaliser (SVG, icône 1024 × 1024 sans
  transparence, image de partage 1200 × 630). Interdits : la croix suisse, toute ressemblance avec
  le logo d'un outil SEO existant.

### Couleurs

| rôle | nom | clair | sombre | usage |
| --- | --- | --- | --- | --- |
| `brand-night` | Nuit glaciaire | `#071A2B` | `#071A2B` | fond du logo, texte, fond du mode sombre |
| `brand-cyan` | Cyan glacier | `#35D0E0` | `#35D0E0` | logo ; couleur d'action en mode sombre |
| `accent` | Cyan lisible | `#076B7A` | `#35D0E0` | boutons, liens, éléments actifs |
| `highlight` | Corail du matin | `#FF6A4D` | `#FF6A4D` | touche rare : sommet du logo, « nouveau » sur fond sombre |
| `surface` | Glace | `#F1F7F9` | `#0C2438` | fonds de page |

Le cyan vif ne porte pas de texte blanc lisible : sur fond clair, l'action utilise le cyan foncé
`#076B7A` (6,2:1). Le corail n'est jamais une couleur de texte sur fond clair, ni une couleur d'erreur
(le rouge reste réservé aux erreurs). Toutes les valeurs : `replica/design/tokens.json`.
Contrôle : `npm run tokens` (53 paires, 0 échec AA).

### Typographie

| police | rôle | licence |
| --- | --- | --- |
| Unbounded (500) | le nom et les grands titres (`h1`) seulement : elle est très large | OFL |
| Instrument Sans | tout le reste : texte, boutons, intertitres | OFL |
| Source Serif 4 | aperçu des articles (lecture longue) | OFL |

## Ton

Trois mots : **clair** (pas de jargon sans explication), **sobre** (pas de superlatifs, pas de
promesses de classement), **suisse** (précis, poli, vouvoiement).

| oui | non |
| --- | --- |
| « Votre article est prêt à relire. » | « Boom ! Votre article de folie est prêt 🚀 » |
| « 3 problèmes à corriger sur votre site. » | « Votre SEO est catastrophique ! » |
| « Plus de visites, article après article. » | « Première place sur Google garantie. » |
| « Le premier arrive demain à 08:00. » | « Restez à l'écoute ! » |
| « La clé a été refusée : reconnectez le site. » | « Erreur 401. » |
