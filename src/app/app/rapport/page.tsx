import type { Metadata } from "next";
import Link from "next/link";
import { FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { isAgency, nextFirst, reportPath } from "@/lib/app/report";
import { alertsConfigured } from "@/lib/app/monitor";
import { siteOrigin } from "@/lib/config";
import { db } from "@/lib/data/store";
import { localDate } from "@/lib/domain/dates";
import { BrandingForm, NewLink, ReportSettings } from "./forms";

export const metadata: Metadata = { title: "Rapport client" };

const dateFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "long", timeZone: "UTC" });

/** Rapport mensuel : aperçu pour tous ; marque de l'agence, lien client et envoi mensuel dans l'offre Agence. */
export default async function ReportSettingsPage() {
  const { workspace, site, subscription } = await requireSite();
  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const preview = <Link href="/rapport/apercu" className={buttonClass("secondary")}>Voir le rapport du mois</Link>;
  if (!isAgency(subscription)) {
    return (
      <>
        <PageHeader title="Rapport client" lead={`Le résumé du mois pour ${host} : articles publiés, positions, visibilité IA, disponibilité. Enregistrable en PDF.`} actions={preview} />
        <EmptyState icon={FileBarChart} title="Rapports à votre marque : offre Agence">
          Avec l'offre Agence, le rapport porte votre logo et vos couleurs, chaque client reçoit un lien pour le lire sans compte, et le rapport lui est envoyé le 1er de chaque mois. 25 sites dans un seul espace. <Link href="/app/abonnement" className="font-semibold text-accent underline underline-offset-2">Voir mon abonnement</Link>
        </EmptyState>
      </>
    );
  }
  const [b, r] = await Promise.all([db.branding(workspace.id), db.reportOf(workspace.id, site.id)]);
  const link = `${siteOrigin(process.env.NEXT_PUBLIC_SITE_URL)}${reportPath(r.token)}`;
  const today = localDate(new Date(), "Europe/Zurich");
  return (
    <>
      <PageHeader title="Rapport client" lead={`Le rapport mensuel de ${host}, à la marque de votre agence. Réglages propres à ce site ; la marque vaut pour tous vos sites.`} actions={preview} />
      {r.monthly && !alertsConfigured() && <Banner tone="warning">L'envoi d'e-mails n'est pas encore branché sur ce serveur : le lien marche, mais l'e-mail mensuel ne part pas.</Banner>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg">Pour le client de ce site</h2>
          {r.shared ? (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Lien du client</p>
              <code className="block break-all rounded-md bg-surface-sunken px-2 py-1 text-xs">{link}</code>
              <div className="flex flex-wrap items-center gap-3"><a href={reportPath(r.token)} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">Ouvrir comme le client</a><NewLink /></div>
              {r.monthly && <p className="text-text-muted">Prochain envoi le {dateFmt.format(new Date(`${nextFirst(today)}T12:00:00Z`)).replace(/^1 /, "1er ")} à {r.clientEmails.join(", ")}.</p>}
            </div>
          ) : <p className="text-sm text-text-muted">Le lien est coupé : activez-le pour que le client lise son rapport.</p>}
          <ReportSettings r={r} />
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg">Marque de l'agence</h2>
          <BrandingForm b={b} />
        </Card>
      </div>
    </>
  );
}
