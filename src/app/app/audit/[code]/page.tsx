import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
export const metadata: Metadata = { title: "Problème d'audit" };
export default function Issue() {
  return <ComingSoon id="S16" title="Détail d'un problème" lead="Les pages concernées et comment corriger." items={["Explication du problème en clair", "Pages touchées (10 au plus affichées)", "Recommandation de correction", "Marquer comme corrigé"]} />;
}
