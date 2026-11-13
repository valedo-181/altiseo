# Annonces de lancement d'Altiseo

Préparées le 13 novembre 2026 pour faire connaître Altiseo. Toutes les longueurs ont été vérifiées par le même
contrôle que celui de l'app (`src/lib/ads/format.ts`). **Rien n'est en ligne** : ces annonces sont à relire,
puis à créer dans vos comptes Google Ads et Meta.

Chaque phrase ne dit que ce que le produit fait aujourd'hui (essai de 3 jours sans carte, dès 99 CHF, un
article par jour, relecture avant parution). À corriger si une offre change.

## Google Ads (réseau de recherche)

Fichier à importer dans Google Ads Editor : `altiseo-google-ads.csv` (campagne créée en pause).

- Adresse de destination : https://www.altiseo.ch/?utm_source=google&utm_medium=cpc&utm_campaign=lancement
- Adresse affichée : www.altiseo.ch/blog-seo/essai
- Zone conseillée : Suisse, langue française. Budget de départ conseillé : 10 à 20 CHF par jour, à ajuster
  après deux semaines selon le coût par inscription.

### Titres (14)

| Titre | Caractères |
|---|---|
| Votre blog SEO écrit pour vous | 30 / 30 |
| Un article par jour | 19 / 30 |
| Blog SEO pour PME suisses | 25 / 30 |
| Essai gratuit de 3 jours | 24 / 30 |
| Sans carte bancaire | 19 / 30 |
| 30 sujets en une minute | 23 / 30 |
| Vous relisez avant parution | 27 / 30 |
| Dès 99 CHF par mois | 19 / 30 |
| Altiseo | 7 / 30 |
| Articles SEO dans votre ton | 27 / 30 |
| Publié sur votre WordPress | 26 / 30 |
| Une photo pour chaque article | 29 / 30 |
| Faites vivre votre blog | 23 / 30 |
| Sans engagement | 15 / 30 |

### Descriptions (4)

| Description | Caractères |
|---|---|
| Altiseo prépare vos sujets, écrit vos articles et les envoie sur votre site. | 76 / 90 |
| Trente sujets tirés de votre activité, un article par jour. Vous relisez, vous publiez. | 87 / 90 |
| Essai gratuit de 3 jours, sans carte bancaire. Dès 99 CHF par mois, sans engagement. | 84 / 90 |
| Des articles dans votre ton, avec leur photo. Rien ne paraît sans votre accord. | 79 / 90 |

### Mots-clés (expression exacte)

- rédaction articles seo
- articles de blog seo
- rédacteur blog entreprise
- automatiser blog wordpress
- outil rédaction seo
- générateur article seo
- blog seo pme
- rédaction web suisse
- contenu seo wordpress
- ia rédaction articles
- créer articles de blog
- logiciel blog entreprise

### Mots à exclure

- gratuit
- emploi
- formation
- stage
- salaire
- cours
- définition
- exemple

## Meta Ads (Facebook et Instagram)

- Adresse de destination : https://www.altiseo.ch/?utm_source=meta&utm_medium=paid_social&utm_campaign=lancement
- Bouton : S'inscrire
- Visuel : la vidéo du sommet de la page d'accueil (`public/brand/sommet.mp4`) ou l'image `public/brand/sommet.jpg`.
- Audience conseillée : Suisse romande, 25 à 60 ans, centres d'intérêt « petite entreprise », « WordPress »,
  « marketing en ligne ». Budget de départ conseillé : 10 CHF par jour.

### Textes principaux (3)

| Texte | Caractères |
|---|---|
| Pas le temps d'écrire pour votre blog ? Altiseo prépare les sujets, écrit un article par jour et l'envoie sur votre site. | 121 / 125 |
| Trente sujets d'articles tirés de votre activité, en une minute. Essai gratuit de 3 jours, sans carte bancaire. | 111 / 125 |
| Un blog qui avance, même quand vous n'avez pas le temps. Vous relisez chaque article avant qu'il paraisse. | 106 / 125 |

### Titre et description

| | Texte | Caractères |
|---|---|---|
| Titre | Votre blog SEO, écrit pour vous | 31 / 40 |
| Description | Essai gratuit de 3 jours | 24 / 30 |

## Avant de lancer

1. Le site doit répondre sur www.altiseo.ch (domaine en cours de branchement).
2. L'inscription doit aboutir : limite de 2 e-mails de connexion par heure tant que Resend n'est pas branché.
3. Les pages légales (mentions, confidentialité) sont exigées par Google et par Meta pour une page de destination.
4. Sans paiement en place (Stripe), un visiteur peut essayer mais pas s'abonner : mieux vaut attendre pour dépenser.
5. L'envoi réel des articles sur le site du client demande `ENCRYPTION_KEY` dans Vercel : sans elle, le titre « Publié sur votre WordPress » n'est pas encore vrai.
