import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
export const metadata: Metadata = { title: "API" };
export default function Api() {
  return <ComingSoon id="S21" title="API et webhook" lead="Pour les sites faits sur mesure." items={["Clés API (montrées une seule fois, gardées hachées)", "Lecture des articles publiés : GET /api/v1/articles", "Webhook signé à chaque article prêt", "Journal des envois"]} />;
}
