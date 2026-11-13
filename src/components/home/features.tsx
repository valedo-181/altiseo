import { isReady, type Feature } from "@/lib/readiness";
import { BarChart3, Bot, FileBarChart, ImageIcon, LineChart, ListChecks, Send, ShieldCheck, TrendingUp } from "lucide-react";

/** Tout ce qu'Altiseo fait autour du blog. Une seule liste, reprise sur l'accueil et sur la page Services. */
export const FEATURES = [
  { group: "Écrire et publier", items: [
    { Icon: ImageIcon, key: "images", title: "Une photo pour chaque article", text: "Une image réaliste créée pour le sujet, sans texte ni visage reconnaissable. Elle part avec l'article comme image mise en avant." },
    { Icon: Send, key: "autopublish", title: "Publication automatique", text: "Chaque matin, l'article du jour s'écrit et part sur votre site, en brouillon ou publié. Seuls les sujets que vous avez approuvés." },
  ] },
  { group: "Mesurer", items: [
    { Icon: LineChart, key: "keywords", title: "Mots-clés", text: "Vos clics, vos affichages et votre position dans Google, tirés de Search Console et suivis jour après jour." },
    { Icon: TrendingUp, key: "positions", title: "Positions Google", text: "La place de votre site sur les mots-clés que vous choisissez, mesurée chaque semaine." },
    { Icon: Bot, key: "aiVisibility", title: "Visibilité IA", text: "Ce que répondent ChatGPT, Gemini, Perplexity et Claude aux questions de vos clients, et s'ils citent votre site." },
    { Icon: BarChart3, key: "stats", title: "Statistiques de visites", text: "Qui vient, d'où, et ce qui est lu. Sans cookies : pas de bandeau de consentement sur votre site." },
  ] },
  { group: "Surveiller et rendre compte", items: [
    { Icon: ListChecks, key: "indexing", title: "Indexation", text: "Les pages que Google a gardées dans son index, et le signalement immédiat de vos nouvelles pages aux moteurs." },
    { Icon: ShieldCheck, key: "guardian", title: "Gardien du site", text: "Votre site vérifié toutes les 5 minutes. Un e-mail en cas de panne, et avant l'expiration du certificat ou du nom de domaine." },
    { Icon: FileBarChart, key: "report", title: "Rapport mensuel", text: "Le résumé du mois en PDF : les articles publiés et les résultats obtenus. À votre logo avec l'offre Agence." },
  ] },
] as const;

/** Les familles et leurs fonctions réellement branchées sur ce serveur (voir src/lib/readiness.ts). */
export function readyFeatures() {
  return FEATURES.map((g) => ({ group: g.group, items: g.items.filter((i) => isReady(i.key as Feature)) })).filter((g) => g.items.length > 0);
}

/** Grille des fonctions prêtes, par famille. Une famille sans fonction prête n'apparaît pas. */
export function FeatureGroups() {
  return (
    <div className="mt-12 space-y-12">
      {readyFeatures().map((g) => (
        <div key={g.group}>
          <h3 className="font-display text-sm font-medium uppercase tracking-[0.14em] text-highlight">{g.group}</h3>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map(({ Icon, title, text }) => (
              <li key={title} className="min-w-0 rounded-xl border border-border bg-surface p-6">
                <Icon aria-hidden="true" className="size-6 text-accent" />
                <p className="mt-4 text-lg font-semibold text-text">{title}</p>
                <p className="mt-2 text-text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
