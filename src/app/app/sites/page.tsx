import type { Metadata } from "next";
import Link from "next/link";
import { switchSite } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { AddSite } from "./forms";

export const metadata: Metadata = { title: "Sites" };

/** Les sites de l'espace (Grow 1, Scale 3, Agence 25) et l'ajout d'un site. */
export default async function Sites() {
  const { workspace, sites, site } = await requireSite();
  const allowed = await db.sitesAllowed(workspace.id);
  const full = sites.length >= allowed;
  return (
    <>
      <PageHeader title="Sites" lead={`${sites.length} site${sites.length > 1 ? "s" : ""} sur ${allowed} compris dans votre offre. Chaque site a son calendrier, ses articles, ses positions et son rapport.`} />
      <ul className="card divide-y divide-border p-0">
        {sites.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{s.name || s.url}</span>
              <span className="block truncate text-sm text-text-muted">{s.url.replace(/^https?:\/\//, "")}{s.onboardingStep < 8 ? " · configuration à terminer" : ""}</span>
            </span>
            {s.id === site.id ? <span className="pill bg-accent/10 text-accent">Site affiché</span> : (
              <form action={switchSite}><input type="hidden" name="siteId" value={s.id} /><button className="btn btn-secondary btn-sm">Afficher ce site</button></form>
            )}
          </li>
        ))}
      </ul>
      <Card>
        {full && <p className="mb-4 text-sm text-text-muted">{allowed === 1 ? <>Votre offre comprend 1 site. Scale en compte 3 et Agence 25. </> : <>Les {allowed} sites de votre offre sont utilisés. </>}<Link href="/app/abonnement" className="font-semibold text-accent underline underline-offset-2">Voir mon abonnement</Link></p>}
        <AddSite disabled={full} />
      </Card>
    </>
  );
}
