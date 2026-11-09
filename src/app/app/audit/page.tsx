import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
export const metadata: Metadata = { title: "Audit" };
export default function Audit() {
  return <ComingSoon id="S15" title="Audit SEO" lead="La santé technique de votre site, notée sur 100." items={["Lecture du site (robots.txt, sitemap, 50 pages) avec le code d'audit de Titanor", "Titres, descriptions, H1, textes alternatifs, liens cassés, données structurées", "Vitesse sur téléphone (PageSpeed)", "Problèmes classés par gravité, avec la correction à faire"]} />;
}
