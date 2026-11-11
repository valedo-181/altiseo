# Journal de construction

Mode démo : données dans `.data/demo.json`, articles d'exemple sans IA, envoi WordPress simulé.
Vérification du parcours : `node scripts/slice-check.cjs` (35 contrôles, voir le README).

| écran | date | état | ce qui manque | plus dur que prévu |
| --- | --- | --- | --- | --- |
| coquille (S11–S23) | 2026-11-09 | fait | — | le menu partagé entre serveur et navigateur ; la marge de la barre latérale manquait dans les jetons |
| S01 vitrine | 2026-11-09 | partiel | textes définitifs (/replica-launch), captures du produit | — |
| S02 tarifs | 2026-11-09 | partiel | prix à confirmer, paiement Stripe | — |
| S03 inscription / connexion | 2026-11-09 | partiel | Supabase Auth (mot de passe ou lien magique, e-mail vérifié, Google) | — |
| S04 adresse du site | 2026-11-09 | partiel | vraie analyse (lecture du site + IA) | — |
| S05 activité | 2026-11-09 | partiel | préremplissage par l'IA | — |
| S06 concurrents | 2026-11-09 | partiel | suggestions automatiques | — |
| S07 langue et ton | 2026-11-09 | fait | — | — |
| S08 publication (WordPress) | 2026-11-09 | partiel | vrai test de connexion, détection du CMS, autres CMS | — |
| S09 planning | 2026-11-09 | fait | — | — |
| S10 offre | 2026-11-09 | partiel | Stripe Checkout | — |
| S11 tableau de bord | 2026-11-09 | partiel | trafic (Search Console), score d'audit | — |
| S12 calendrier | 2026-11-09 | partiel | volume et difficulté (DataForSEO), vrais sujets (IA), vue mois | il ne restait aucun sujet de rechange avec 30 modèles pour 30 jours |
| S13 articles | 2026-11-09 | fait | recherche, actions groupées | — |
| S14 article | 2026-11-09 | partiel | rédaction IA, image à la une, JSON-LD | React 19 vide les champs après envoi ; retours à la ligne \r\n des navigateurs |
| S15 audit | 2026-11-11 | fait | historique des audits, audit mensuel automatique ; pas encore essayé sur un vrai site en ligne | adapter le contrôle « entreprise locale » de Titanor en « données structurées » |
| S16 détail d'audit | 2026-11-11 | fait | marquer un problème comme corrigé | — |
| S17 intégrations | 2026-11-09 | partiel | envoi réel, Webflow, Shopify, webhook | — |
| S18 réglages rédaction | 2026-11-09 | fait | — | — |
| S19 réglages images | 2026-11-09 | à faire | choix de la source d'images | — |
| S20 réglages planning | 2026-11-09 | fait | — | — |
| S21 API | 2026-11-09 | à faire | clés, API publique, webhook | — |
| S22 abonnement | 2026-11-09 | partiel | Stripe, changement d'offre, annulation | — |
| S23 sélecteur de site | 2026-11-09 | partiel | bouton « ajouter un site » dans le menu | — |

Parité (`parity.py`) : 44,3 / 100, indispensables 8 sur 25.
