import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { adminContext, loadFailures } from "@/lib/admin/context";
import { MfaScreen } from "../mfa";
import { dayTime } from "../ui";
import { Retry } from "./retry";

export const metadata: Metadata = { title: "Suivi technique" };

const KIND = { publication: "Envoi au site refusé", topic: "Rédaction en échec", job: "Tâche bloquée" } as const;

/** Ce qui a échoué chez les clients, du plus récent au plus ancien. */
export default async function Technical() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const list = await loadFailures(ctx);
  return (
    <>
      <PageHeader title="Suivi technique" lead="Envois refusés par le site du client, rédactions en échec et tâches bloquées. 200 lignes au plus." />
      {!list.length ? (
        <EmptyState icon={CheckCircle2} title="Rien en échec">Tout ce qui devait partir est parti.</EmptyState>
      ) : (
        <Card className="divide-y divide-border p-0">
          {list.map((f) => (
            <div key={`${f.kind}-${f.id}`} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm"><span className="pill mr-2 bg-danger-soft text-danger">{KIND[f.kind]}</span><span className="font-semibold">{f.label}</span></p>
                <p className="mt-1 text-xs text-text-muted">
                  {f.workspace_id ? <Link href={`/admin/clients/${f.workspace_id}`} className="text-accent underline underline-offset-2">{f.workspace_name}</Link> : "—"} · {dayTime(f.at)}
                </p>
                {f.error && <p className="mt-1 break-words text-xs text-danger">{f.error}</p>}
              </div>
              {f.kind === "publication"
                ? <span className="text-xs text-text-muted">Le client corrige sa connexion, puis renvoie l'article.</span>
                : <Retry kind={f.kind} id={f.id} />}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
