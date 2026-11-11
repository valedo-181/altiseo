import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { issueScope, issueText, LEVEL_LABEL } from "@/lib/seo/report";

export const metadata: Metadata = { title: "Problème d'audit" };

const TONE = { critical: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info" } as const;

/** S16 : un problème de l'audit, pourquoi il compte, comment le corriger, sur quelles pages. */
export default async function Issue({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { workspace, site } = await requireSite();
  const audit = await db.latestAudit(workspace.id, site.id);
  const issue = audit?.issues.find((i) => i.code === code);
  if (!issue) notFound();
  const t = issueText(issue.code);
  return (
    <>
      <div className="space-y-2">
        <Link href="/app/audit" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden="true" className="size-4" />Audit</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-xl md:text-2xl">{t.title}</h1>
          <span className={`pill ${TONE[issue.level]}`}>{LEVEL_LABEL[issue.level]}</span>
        </div>
        {issueScope(issue) && <p className="text-sm text-text-muted">Concerne {issueScope(issue)}.</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h2 className="text-sm font-semibold">Pourquoi c'est important</h2><p className="mt-2 text-sm text-text-muted">{t.why}</p></Card>
        <Card><h2 className="text-sm font-semibold">Comment corriger</h2><p className="mt-2 text-sm text-text-muted">{t.fix}</p></Card>
      </div>
      {issue.pages.length > 0 && (
        <section aria-labelledby="h-pages" className="space-y-3">
          <h2 id="h-pages" className="text-lg">Pages concernées{issue.affected > issue.pages.length ? ` (les ${issue.pages.length} premières)` : ""}</h2>
          <Card className="divide-y divide-border p-0">
            {issue.pages.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface">
                <span className="min-w-0 flex-1 truncate">{u.replace(/^https?:\/\//, "")}</span>
                <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" /><span className="sr-only">(nouvel onglet)</span>
              </a>
            ))}
          </Card>
        </section>
      )}
    </>
  );
}
