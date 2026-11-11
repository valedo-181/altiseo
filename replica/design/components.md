# Composants

Système original : aucun écran de l'application d'origine n'a été mesuré (le réseau bloquait le
site, voir `replica/recon.md`). Les composants viennent de la liste de la recon et des besoins des
écrans S01–S23. Jetons : `tokens.json` → `tokens.css` + `tailwind.preset.ts`
(`python3 -I replica/design/build_tokens.py`). Aperçu : `preview.html`, capture `preview.png`.

Règles communes :
- **jetons seulement** : `bg-surface text-muted border-border`, jamais de hex dans un composant ;
- **focus visible partout** : `focus-visible:shadow-focus` (anneau de 2 px, couleur `focus`, contraste ≥ 3:1) ;
- **cible tactile ≥ 40 px** sur mobile ; textes en 14 px minimum dans l'app, 16 px dans les formulaires ;
- **icônes** : Lucide (licence ISC), 16 px dans les boutons et pastilles, 20 px dans la navigation,
  `aria-hidden` quand un texte les accompagne ;
- **polices** : Unbounded pour le nom et les `h1`, Instrument Sans pour l'interface, Source Serif 4 pour l'aperçu des articles (toutes OFL) ;
- **mouvement** : 120–200 ms ; rien d'animé si `prefers-reduced-motion`.

```
Button
  variants  primary (accent), secondary (bordure), ghost, danger
  sizes     sm 32px, md 40px, lg 48px ; icône seule : carré de la même taille
  states    default, hover (accent-hover), active, focus-visible, disabled (opacité 50 %, pas d'action),
            loading (indicateur + libellé conservé, aria-busy)
  tokens    bg accent, text on-accent, radius md, xs/sm 600
  a11y      vrai <button> ; « icône seule » a un aria-label ; un bouton danger demande confirmation (Modal)
  used on   partout
```

```
TextField / UrlField
  variants  texte, e-mail, URL (préfixe « https:// » non modifiable), mot de passe (afficher / masquer)
  sizes     md 40px (app), lg 48px (onboarding, vitrine)
  states    vide, rempli, focus, erreur (bordure danger + message sous le champ), désactivé, lecture seule
  tokens    bg bg, border border-input, radius md, text base (16px, pas de zoom iOS)
  a11y      <label> toujours visible ; aide et erreur reliées par aria-describedby ; aria-invalid en erreur
  used on   S03, S04, S06, S08, S21
```

```
TextArea with counter
  variants  1000 caractères (instructions), 4000 (activité)
  states    vide, rempli, proche de la limite (compteur en warning dès 90 %), dépassé (danger, envoi bloqué)
  tokens    comme TextField ; compteur xs text-muted
  a11y      compteur annoncé en aria-live="polite" seulement près de la limite
  used on   S05, S18
```

```
Select / Combobox
  variants  liste simple (langue, fuseau), recherche (fuseau horaire : ~400 entrées)
  states    fermé, ouvert, option active, vide (« aucun résultat »), désactivé
  tokens    comme TextField ; menu bg bg, shadow pop, radius lg
  a11y      Radix Select / Combobox : flèches, Entrée, Échap, saisie pour sauter
  used on   S07, S09, S20
```

```
Switch
  states    on, off, focus, désactivé
  tokens    piste accent (on) / surface-sunken + bordure border-input (off), pastille bg
  a11y      role="switch", aria-checked ; libellé cliquable ; texte d'aide sous le libellé
  used on   S09, S18, S19, S20
```

```
Stepper (onboarding)
  variants  barre horizontale (≥ md), « Étape 3 sur 7 » + barre de progression (mobile)
  states    faite (coche, cliquable pour revenir), actuelle (accent), à venir (text-muted)
  a11y      <ol> ; étape actuelle aria-current="step"
  used on   S04–S10
```

```
PlanCard
  variants  mensuel, annuel (économie affichée), recommandée (bordure accent + badge)
  states    défaut, sélectionnée (radio), désactivée (offre actuelle)
  tokens    bg bg, border border, radius xl, shadow card ; prix 2xl
  a11y      groupe de boutons radio ; prix lu avec la période (« 99 francs par mois »)
  used on   S02, S10, S22
```

```
IntegrationCard
  variants  WordPress, webhook, Webflow, Shopify, Ghost, Wix, Framer (logo de la marque sur fond neutre, avec son nom écrit)
  states    non connecté, détecté (badge info « Détecté »), connecté (success), en erreur (danger + message), bientôt (désactivé)
  tokens    bg bg, border border, radius lg ; badge selon l'état
  a11y      la carte entière n'est pas un lien : bouton « Connecter » explicite
  used on   S08, S17
```

```
KpiCard
  variants  nombre, nombre + évolution (flèche + %, success / danger), jauge (score d'audit)
  states    chargement (squelette), vide (« — » + phrase d'aide), rempli
  tokens    bg bg, border border, radius lg ; valeur 2xl/700 ; libellé sm text-muted
  used on   S11, S15
```

```
StatusPill
  variants  proposé (neutre), approuvé (info), en rédaction (warning + point animé), brouillon (neutre),
            planifié (info), publié (success), échec (danger), sauté (neutre barré)
  tokens    fond *-soft, texte de la couleur d'état, xs/500, radius pill, icône 12px
  a11y      la couleur n'est jamais seule : texte + icône
  used on   S12, S13, S14
```

```
Difficulty / Volume
  variants  difficulté : facile 0–29 (success), moyenne 30–59 (warning), difficile 60–100 (danger) ;
            volume : nombre arrondi (« 1,2 k ») + barre de 4 segments
  states    inconnu (« — », sans données de mots-clés)
  a11y      texte lisible (« Difficulté 42 sur 100, moyenne »)
  used on   S12, S14
```

```
CalendarView
  variants  mois (grille 7 colonnes, ≥ md), liste par jour (mobile, et choix sur desktop)
  states    jour vide, sujet proposé, approuvé, en rédaction, publié, échec ; jour passé (atténué) ;
            aujourd'hui (anneau accent) ; chargement (squelettes) ; génération en cours (bandeau)
  actions   par sujet : approuver, régénérer (compteur « 2 sur 5 »), sauter, ouvrir ; en tête : tout approuver
  a11y      grille role="grid", flèches pour passer d'un jour à l'autre ; chaque jour a une date lisible
  used on   S12
```

```
DataTable
  variants  avec tri, filtres (pastilles de statut), recherche, sélection multiple (barre d'actions)
  states    chargement (5 lignes squelettes), vide (EmptyState), rempli, erreur ; pagination
  responsive  < md : chaque ligne devient une carte empilée
  a11y      <table> réel ; en-têtes triables = boutons avec aria-sort
  used on   S13, S15, S16
```

```
RichEditor (article)
  variants  édition, aperçu (police serif, largeur de lecture 720px)
  outils    titres H2 / H3, gras, italique, liste, lien, citation, image ; annuler / rétablir
  states    enregistré, modifications non enregistrées (pastille), enregistrement, conflit (article
            modifié ailleurs : choisir la version)
  a11y      barre d'outils role="toolbar" avec flèches ; raccourcis clavier usuels
  used on   S14
```

```
SeoMetaPanel
  champs    titre SEO (compteur 60), description (compteur 160), slug (minuscules, tirets), mots-clés
  extras    aperçu « résultat Google » (titre, URL, description tronqués comme dans les résultats)
  states    OK, trop long (warning), vide (danger)
  used on   S14
```

```
ScoreGauge
  variants  grand (S15), petit (S11)
  couleurs  0–49 danger, 50–89 warning, 90–100 success ; nombre au centre
  states    jamais lancé (« Lancer l'audit »), en cours (anneau indéterminé), terminé
  a11y      role="meter" avec aria-valuenow / min / max
  used on   S11, S15
```

```
IssueRow
  variants  critique (danger), avertissement (warning), info (info)
  contenu   intitulé, pages touchées « 12 sur 48 », bouton « Voir les pages », état corrigé / ouvert
  used on   S15, S16
```

```
Toast
  variants  succès, erreur (reste jusqu'à fermeture), info
  tokens    bg text (inversé), text bg, radius lg, shadow pop
  a11y      zone aria-live (polite ; assertive pour les erreurs) ; ne prend jamais le focus
  used on   partout
```

```
Modal / ConfirmDialog
  variants  normal, danger (bouton rouge, rappel de ce qui sera perdu)
  states    ouvert, envoi en cours
  a11y      Radix Dialog : focus piégé, Échap ferme, focus rendu au bouton d'origine
  used on   S14, S17, S22
```

```
EmptyState
  contenu   icône 24px, titre, une phrase, une action principale
  exemples  articles : « Votre premier article arrive demain à 8 h » ; audit : « Pas encore d'audit »
  used on   S11, S13, S15
```

```
Banner (essai / quota / paiement)
  variants  info (essai : « 2 jours restants »), warning (quota bas, 3 articles restants),
            danger (paiement en retard), succès
  a11y      role="status" ; une seule bannière à la fois, la plus grave
  used on   toutes les pages connectées
```

```
AppShell
  sidebar   248px, navigation 20px (Tableau de bord, Calendrier, Articles, Audit, Intégrations, Réglages)
  topbar    56px : sélecteur de site (S23), quota du mois, menu du compte
  mobile    < lg : sidebar en tiroir, barre du bas à 4 onglets
  a11y      lien « Aller au contenu » ; nav aria-label ; page courante aria-current="page"
  used on   S11–S23
```

```
Skeleton
  variants  ligne, carte, cellule de calendrier
  tokens    surface-sunken, pulsation 1,2 s (arrêtée si prefers-reduced-motion)
  used on   S11, S12, S13, S15
```
