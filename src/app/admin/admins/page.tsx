import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { adminContext, loadAdmins } from "@/lib/admin/context";
import { MfaScreen } from "../mfa";
import { day } from "../ui";
import { AddAdminForm, RemoveAdminForm } from "./forms";

export const metadata: Metadata = { title: "Administrateurs" };

/** Qui a accès à la console. Chacun a sa propre double authentification ; chaque action est au journal. */
export default async function Admins() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const admins = await loadAdmins(ctx);
  return (
    <>
      <PageHeader title="Administrateurs" lead="Les personnes qui peuvent ouvrir cette console. Elles voient tous les clients et peuvent les modifier : ne donnez cet accès qu'à des personnes de confiance." />
      {admins === null ? <Banner tone="warning">Cette page demande une mise à jour de la base qui n'a pas encore été appliquée.</Banner> : (
        <>
          <Card className="divide-y divide-border p-0">
            {admins.map((a) => (
              <div key={a.user_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.email ?? "—"}{a.is_me && <span className="ml-2 pill bg-accent-soft text-accent">Vous</span>}</p>
                  <p className="text-xs text-text-muted">Accès depuis le {day(a.added_at)}{a.added_by_email ? `, donné par ${a.added_by_email}` : ""} · dernière connexion {day(a.last_sign_in)}</p>
                </div>
                <span className={`pill ${a.mfa_ready ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{a.mfa_ready ? "Double authentification active" : "Double authentification à configurer"}</span>
                {!a.is_me && <RemoveAdminForm id={a.user_id} email={a.email ?? ""} />}
              </div>
            ))}
          </Card>
          <Card className="max-w-xl space-y-3">
            <h2 className="font-semibold">Ajouter un administrateur</h2>
            <AddAdminForm />
            <p className="text-xs text-text-muted">Vous ne pouvez pas retirer votre propre accès : il reste ainsi toujours au moins un administrateur. Dix au plus.</p>
          </Card>
        </>
      )}
    </>
  );
}
