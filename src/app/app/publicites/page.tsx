import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonClass } from "@/components/ui/button";
import { Banner, EmptyState } from "@/components/ui/feedback";
import { requireSite } from "@/lib/app/context";
import { config } from "@/lib/config";
import { db } from "@/lib/data/store";
import { PrepareAds } from "./buttons";

export const metadata: Metadata = { title: "Publicités" };
export const maxDuration = 120;

/** S32 : annonces Google Ads et Meta Ads préparées à partir des articles. */
export default async function Ads() {
  const { workspace, site } = await requireSite();
  const [articles, drafts] = await Promise.all([db.listArticles(workspace.id, site.id), db.listAdDrafts(workspace.id, site.id)]);
  const byArticle = new Map(drafts.map((d) => [d.articleId, d]));
  const approved = drafts.filter((d) => d.status === "approved").length;
  return (
    <>
      <PageHeader
        title="Publicités"
        lead={<>Pour chaque article, Altiseo prépare une annonce Google Ads et une publicité Meta (Facebook, Instagram). Vous relisez, vous validez, puis vous les mettez en ligne vous-même : rien ne part et rien n'est dépensé sans vous.</>}
      />
      {!config.ai && <Banner tone="info"><strong className="font-semibold">Annonces d'exemple :</strong> sans le service de rédaction, les textes sont des modèles. Les vraies annonces tiendront compte de votre activité et de l'article.</Banner>}
      {!articles.length ? (
        <EmptyState icon={Megaphone} title="Pas encore d'article à promouvoir" action={<Link href="/app/calendrier" className={buttonClass("primary")}>Ouvrir le calendrier</Link>}>
          Les annonces se préparent à partir d'un article : écrivez-en un d'abord.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-text-muted">{drafts.length} article{drafts.length > 1 ? "s" : ""} avec des annonces, dont {approved} validée{approved > 1 ? "s" : ""}.</p>
          <ul className="card divide-y divide-border p-0">
            {articles.map((a) => {
              const d = byArticle.get(a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-text-muted">{a.status === "published" ? "Article en ligne" : "Article pas encore en ligne : publiez-le avant de lancer une annonce"}</p>
                  </div>
                  {d ? (
                    <>
                      <span className={`pill ${d.status === "approved" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{d.status === "approved" ? "Validées" : "À relire"}</span>
                      <Link href={`/app/publicites/${a.id}`} className={buttonClass("secondary", "sm")}>Voir les annonces</Link>
                    </>
                  ) : (
                    <PrepareAds id={a.id} small />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
