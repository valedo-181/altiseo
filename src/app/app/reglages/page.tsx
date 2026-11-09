import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireSite } from "@/lib/app/context";
import { ScheduleForm, WritingForm } from "./forms";

export const metadata: Metadata = { title: "Réglages" };

/** S18 rédaction, S19 visuels, S20 planning ; liens vers S21 (API) et S22 (abonnement). */
export default async function Settings() {
  const { site } = await requireSite();
  return (
    <>
      <PageHeader title="Réglages" lead={`Pour ${site.name}. Les changements s'appliquent aux prochains articles.`} />
      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {[["#redaction", "Rédaction"], ["#planning", "Planning"], ["#visuels", "Images"], ["/app/reglages/api", "API"], ["/app/abonnement", "Abonnement"]].map(([h, l]) => (
          <Link key={h} href={h} className="pill h-8 bg-bg px-3 text-sm text-text-muted ring-1 ring-border hover:text-text">{l}</Link>
        ))}
      </nav>
      <section id="redaction" aria-labelledby="h-red" className="space-y-3">
        <h2 id="h-red" className="text-lg">Rédaction</h2>
        <Card><WritingForm site={site} /></Card>
      </section>
      <section id="planning" aria-labelledby="h-plan" className="space-y-3">
        <h2 id="h-plan" className="text-lg">Planning</h2>
        <Card><ScheduleForm site={site} /></Card>
      </section>
      <section id="visuels" aria-labelledby="h-vis" className="space-y-3">
        <h2 id="h-vis" className="text-lg">Images</h2>
        <Card><p className="text-sm text-text-muted">Image à la une de chaque article : en construction (S19). Le choix de la source (banque d'images ou génération) se fera avec le backend.</p></Card>
      </section>
    </>
  );
}
