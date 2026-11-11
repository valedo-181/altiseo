import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { adminContext, loadFailures } from "@/lib/admin/context";
import { config, cronMode } from "@/lib/config";
import { MfaScreen } from "../mfa";
import { dayTime } from "../ui";
import { Retry } from "./retry";

export const metadata: Metadata = { title: "Suivi technique" };

const KIND = { publication: "Envoi au site refusé", topic: "Rédaction en échec", job: "Tâche bloquée" } as const;

/** Présence des réglages seulement : aucune valeur n'est lue ni affichée. */
const SERVICES = (): Array<[string, boolean, string]> => [
  ["Rédaction (Claude)", config.ai, "ANTHROPIC_API_KEY"],
  ["Envoi à WordPress", config.cms, "ENCRYPTION_KEY"],
  ["Images des articles (Higgsfield)", config.images, "HIGGSFIELD_KEY_ID"],
  ["Mots-clés (Google Search Console)", config.search, "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et ENCRYPTION_KEY"],
  [`Publication automatique (${cronMode === "hourly" ? "chaque heure" : "chaque jour"})`, Boolean(process.env.CRON_SECRET?.trim()), "CRON_SECRET"],
];

/** Ce qui a échoué chez les clients, du plus récent au plus ancien. */
export default async function Technical() {
  const ctx = await adminContext();
  if (ctx.mfa !== "ok") return <MfaScreen ctx={ctx} />;
  const list = await loadFailures(ctx);
  return (
    <>
      <PageHeader title="Suivi technique" lead="Envois refusés par le site du client, rédactions en échec et tâches bloquées. 200 lignes au plus." />
      <Card>
        <h2 className="font-semibold">Services branchés</h2>
        <p className="mt-1 text-xs text-text-muted">Ce que ce serveur voit de ses réglages (variables Vercel). Après un changement dans Vercel, il faut redéployer.</p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {SERVICES().map(([name, on, off]) => (
            <li key={name} className="flex items-start gap-2">
              {on ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />}
              <span><span className="font-medium">{name}</span> : {on ? "branché" : <span className="text-text-muted">non branché ({off})</span>}</span>
            </li>
          ))}
        </ul>
      </Card>
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
