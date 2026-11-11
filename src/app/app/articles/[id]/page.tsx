import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Banner } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { MAX_IMAGE_GENERATIONS } from "@/lib/images/prompt";
import { ArticleEditor } from "./editor";
import { ArticleImage } from "./image";

/** Rédaction et analyse par l'IA : jusqu'à quelques minutes (Vercel Pro). */
export const maxDuration = 300;

export const metadata: Metadata = { title: "Article" };

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ecrit?: string }> }) {
  const [{ id }, { ecrit }] = await Promise.all([params, searchParams]);
  const { workspace, site } = await requireSite();
  const article = await db.getArticle(workspace.id, id).catch(() => null);
  if (!article || article.siteId !== site.id) notFound();
  const [integrations, publication] = await Promise.all([db.listIntegrations(workspace.id, site.id), db.publicationOf(workspace.id, article.id)]);
  const wp = integrations.find((i) => i.status === "ok");
  return (
    <>
      <div className="space-y-2">
        <Link href="/app/articles" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden="true" className="size-4" />Articles</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-xl md:text-2xl">{article.title}</h1>
          <StatusPill status={article.status === "archived" ? "skipped" : article.status} />
        </div>
        {publication?.status === "ok" && (
          <p className="text-sm text-text-muted">
            Envoyé à WordPress le {new Date(publication.lastAttemptAt).toLocaleString("fr-CH", { dateStyle: "medium", timeStyle: "short", timeZone: site.timezone })}
            {publication.remoteUrl && <> · <a href={publication.remoteUrl} className="inline-flex items-center gap-1 text-accent underline underline-offset-2" rel="noopener" target="_blank">ouvrir <ExternalLink aria-hidden="true" className="size-3" /><span className="sr-only">(nouvel onglet, simulation)</span></a></>}
          </p>
        )}
      </div>
      {ecrit && <Banner tone="success">L'article est écrit. Relisez-le, corrigez si besoin, puis envoyez-le à WordPress.</Banner>}
      {article.demo && <Banner tone="warning">Texte d'exemple (mode démo, sans IA) : la vraie rédaction tiendra compte de votre activité, de vos consignes et des recherches de vos clients.</Banner>}
      <ArticleImage id={article.id} url={article.imageUrl} alt={article.imageAlt} demo={article.imageDemo} left={Math.max(0, MAX_IMAGE_GENERATIONS - (article.imageGenerations ?? 0))} />
      <ArticleEditor article={article} siteUrl={site.url} canPublish={!!wp} publishMode={site.publishMode} />
    </>
  );
}
