import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ACTION_LABEL, describe } from "@/lib/admin/console";
import { adminContext, loadJournal } from "@/lib/admin/context";
import { MfaScreen } from "../mfa";
import { dayTime } from "../ui";

export const metadata: Metadata = { title: "Journal" };

/** Trace de chaque action faite depuis la console. Écrite par la base, non modifiable d'ici. */
export default async function Journal() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const rows = await loadJournal(ctx, null, 200);
  return (
    <>
      <PageHeader title="Journal" lead="Qui a fait quoi, et quand. Les 200 dernières actions de la console." />
      {!rows.length ? (
        <EmptyState icon={ScrollText} title="Aucune action pour l'instant">Suspensions, essais prolongés, changements d'offre et relances apparaîtront ici.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Journal des actions</caption>
            <thead className="bg-surface text-left text-text-muted">
              <tr><th className="px-4 py-2 font-semibold">Date</th><th className="px-4 py-2 font-semibold">Action</th><th className="px-4 py-2 font-semibold">Client</th><th className="px-4 py-2 font-semibold">Détail</th><th className="px-4 py-2 font-semibold">Par</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((j, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-4 py-2 text-text-muted">{dayTime(j.at)}</td>
                  <td className="px-4 py-2 font-semibold">{ACTION_LABEL[j.action] ?? j.action}</td>
                  <td className="px-4 py-2">{j.workspace_id ? <Link href={`/admin/clients/${j.workspace_id}`} className="hover:underline">{j.workspace_name ?? "—"}</Link> : "—"}</td>
                  <td className="px-4 py-2 text-text-muted">{describe(j.action, j.data)}</td>
                  <td className="px-4 py-2 text-text-muted">{j.admin_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
