import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status";
import { requireSite } from "@/lib/app/context";
import { cx } from "@/lib/cx";
import { db } from "@/lib/data/store";
import type { ArticleStatus } from "@/lib/domain/types";

export const metadata: Metadata = { title: "Articles" };

const FILTERS: Array<[ArticleStatus | "all", string]> = [["all", "Tous"], ["draft", "Brouillons"], ["published", "Publiés"], ["failed", "Échecs"]];
const dateFmt = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short" });

/** S13 : liste des articles, filtre par état. */
export default async function Articles({ searchParams }: { searchParams: Promise<{ etat?: string }> }) {
  const { etat = "all" } = await searchParams;
  const { workspace, site } = await requireSite();
  const all = await db.listArticles(workspace.id, site.id);
  const list = etat === "all" ? all : all.filter((a) => a.status === etat);
  return (
    <>
      <PageHeader title="Articles" lead={`${all.length} article${all.length > 1 ? "s" : ""} pour ${site.name}.`} />
      <nav aria-label="Filtrer par état" className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => {
          const n = k === "all" ? all.length : all.filter((a) => a.status === k).length;
          return (
            <Link key={k} href={k === "all" ? "/app/articles" : `/app/articles?etat=${k}`} aria-current={etat === k ? "page" : undefined}
              className={cx("pill h-8 px-3 text-sm", etat === k ? "bg-accent text-on-accent" : "bg-bg text-text-muted ring-1 ring-border hover:text-text")}>
              {label} <span className="tabular-nums">{n}</span>
            </Link>
          );
        })}
      </nav>
      {!list.length ? (
        <EmptyState icon={FileText} title={all.length ? "Aucun article dans cette catégorie" : "Pas encore d'article"}
          action={<Link href="/app/calendrier" className={buttonClass("primary", "sm")}>Aller au calendrier</Link>}>
          {all.length ? "Changez de filtre pour voir les autres." : "Écrivez votre premier article depuis le calendrier."}
        </EmptyState>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Articles</caption>
            <thead className="hidden bg-surface text-left text-text-muted md:table-header-group">
              <tr><th className="px-4 py-2 font-semibold">Titre</th><th className="px-4 py-2 font-semibold">Mot-clé</th><th className="px-4 py-2 font-semibold">Mots</th><th className="px-4 py-2 font-semibold">État</th><th className="px-4 py-2 font-semibold">Créé</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((a) => (
                <tr key={a.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface md:table-row md:p-0">
                  <td className="min-w-0 md:px-4 md:py-3"><Link href={`/app/articles/${a.id}`} className="font-semibold hover:underline">{a.title}</Link></td>
                  <td className="col-start-1 text-text-muted md:px-4 md:py-3">{a.keywords[0] ?? "—"}</td>
                  <td className="hidden tabular-nums text-text-muted md:table-cell md:px-4 md:py-3">{a.wordCount}</td>
                  <td className="col-start-2 row-span-2 row-start-1 self-center md:px-4 md:py-3"><StatusPill status={a.status === "archived" ? "skipped" : a.status} /></td>
                  <td className="hidden text-text-muted md:table-cell md:px-4 md:py-3">{dateFmt.format(new Date(a.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
