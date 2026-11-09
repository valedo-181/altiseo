import type { Metadata } from "next";
import { disconnectIntegration } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { WordPressForm } from "./forms";

export const metadata: Metadata = { title: "Intégrations" };

const SOON = [["Webflow", "WF"], ["Shopify", "SH"], ["Webhook (site sur mesure)", "{ }"], ["Ghost", "GH"], ["Wix", "WX"], ["Framer", "FR"]];

/** S17 : intégrations CMS. Une seule active par site. */
export default async function Integrations() {
  const { workspace, site } = await requireSite();
  const wp = (await db.listIntegrations(workspace.id, site.id)).find((i) => i.kind === "wordpress");
  return (
    <>
      <PageHeader title="Intégrations" lead="Où vos articles sont envoyés. Une intégration active par site." />
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-xs font-bold text-text-muted" aria-hidden="true">WP</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">WordPress</h2>
            <p className="text-xs text-text-muted">API REST de WordPress et mot de passe d'application : rien à installer.</p>
          </div>
          {wp?.status === "ok" && <span className="pill bg-success-soft text-success">Connecté{wp.demo ? " (simulation)" : ""}</span>}
        </div>
        {wp?.status === "ok" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface p-3 text-sm">
            <span>{wp.config.endpoint?.replace("https://", "")} · {wp.config.username}{wp.lastTestedAt && <span className="text-text-muted"> · testé le {new Date(wp.lastTestedAt).toLocaleDateString("fr-CH")}</span>}</span>
            <form action={disconnectIntegration}><input type="hidden" name="id" value={wp.id} /><button className="btn btn-secondary btn-sm">Déconnecter</button></form>
          </div>
        ) : (
          <WordPressForm endpoint={site.url} />
        )}
        {wp?.demo && <p className="text-xs text-text-muted">Mode démo : le mot de passe n'est pas conservé et aucun article n'est réellement envoyé.</p>}
      </Card>
      <section aria-labelledby="h-soon" className="space-y-3">
        <h2 id="h-soon" className="text-sm font-semibold text-text-muted">Bientôt</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SOON.map(([name, k]) => (
            <li key={name} className="card flex items-center gap-3 opacity-70">
              <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-xs font-bold text-text-muted" aria-hidden="true">{k}</span>
              <span className="flex-1 text-sm font-semibold">{name}</span>
              <span className="pill bg-surface-sunken text-text-muted">Bientôt</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
