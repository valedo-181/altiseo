import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { approveAds } from "@/app/actions";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { landingUrl, len, LIMITS, MAX_AD_GENERATIONS, META_CTA } from "@/lib/ads/format";
import { requireSite } from "@/lib/app/context";
import { db } from "@/lib/data/store";
import { CopyButton, PrepareAds } from "../buttons";

export const metadata: Metadata = { title: "Annonces de l'article" };
export const maxDuration = 120;

function Line({ text, max }: { text: string; max: number }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1">{text}</span>
      <span className="shrink-0 text-xs tabular-nums text-text-muted" aria-label={`${len(text)} caractères sur ${max}`}>{len(text)} / {max}</span>
      <CopyButton text={text} />
    </li>
  );
}

/** S33 : les annonces d'un article, à relire, valider, copier ou exporter. */
export default async function ArticleAds({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, site } = await requireSite();
  const article = await db.getArticle(workspace.id, id).catch(() => null);
  if (!article || article.siteId !== site.id) notFound();
  const d = await db.adDraftOf(workspace.id, article.id);
  const back = <Link href="/app/publicites" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text"><ArrowLeft aria-hidden="true" className="size-4" />Publicités</Link>;

  if (!d) {
    return (
      <>
        <div className="space-y-2">{back}<h1 className="text-xl md:text-2xl">{article.title}</h1></div>
        <Card className="space-y-3"><p className="text-sm text-text-muted">Aucune annonce n'a encore été préparée pour cet article.</p><PrepareAds id={article.id} /></Card>
      </>
    );
  }

  const host = new URL(d.landingUrl).host;
  const shown = [d.google.path1, d.google.path2].filter(Boolean).join("/");
  const gUrl = landingUrl(d.landingUrl, "google", article.slug), mUrl = landingUrl(d.landingUrl, "meta", article.slug);
  const left = Math.max(0, MAX_AD_GENERATIONS - d.generations);
  const ownImage = article.imageUrl && !article.imageDemo ? article.imageUrl : null;
  return (
    <>
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-xl md:text-2xl">{article.title}</h1>
          <span className={`pill ${d.status === "approved" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>{d.status === "approved" ? "Annonces validées" : "À relire"}</span>
        </div>
      </div>

      {d.demo && <Banner tone="warning">Annonces d'exemple (sans service de rédaction) : ne les mettez pas en ligne telles quelles.</Banner>}
      {article.status !== "published" && <Banner tone="info">L'article n'est pas encore en ligne. Publiez-le d'abord : une annonce qui mène à une page introuvable est refusée par Google et par Meta.</Banner>}

      <Card className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-text-muted">
          {d.status === "approved" ? "Vous avez validé ces annonces. Copiez-les ou importez-les dans vos comptes publicitaires." : "Relisez chaque texte : vous seul savez ce que votre entreprise peut promettre. Rien n'est envoyé à Google ni à Meta."}
        </p>
        <form action={approveAds}>
          <input type="hidden" name="id" value={article.id} />
          <input type="hidden" name="approved" value={d.status === "approved" ? "0" : "1"} />
          <button className={buttonClass(d.status === "approved" ? "secondary" : "primary")}>{d.status === "approved" ? "Repasser en relecture" : "Valider les annonces"}</button>
        </form>
        {left > 0 ? <PrepareAds id={article.id} again /> : <p className="text-xs text-text-muted">Nombre maximal de versions atteint.</p>}
      </Card>

      <section aria-labelledby="h-google" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="h-google" className="text-lg">Google Ads</h2><p className="text-sm text-text-muted">Annonce responsive pour le réseau de recherche. Google combine lui-même titres et descriptions.</p></div>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href={`/app/publicites/${article.id}/google.csv`} className={buttonClass("secondary", "sm")}><Download aria-hidden="true" className="size-4" />Fichier pour Google Ads Editor</a>
        </div>
        <Card>
          <p className="text-xs text-text-muted">Aperçu (une des combinaisons possibles)</p>
          <div className="mt-2 rounded-md border border-border p-4">
            <p className="text-xs"><span className="font-semibold">Sponsorisé</span> · {host}{shown ? `/${shown}` : ""}</p>
            <p className="mt-1 text-lg text-info">{d.google.headlines.slice(0, 3).join(" | ")}</p>
            <p className="mt-1 text-sm text-text-muted">{d.google.descriptions.slice(0, 2).join(" ")}</p>
          </div>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><h3 className="font-semibold">Titres ({d.google.headlines.length})</h3><ul className="mt-2 divide-y divide-border text-sm">{d.google.headlines.map((t) => <Line key={t} text={t} max={LIMITS.google.headline} />)}</ul></Card>
          <div className="space-y-4">
            <Card><h3 className="font-semibold">Descriptions ({d.google.descriptions.length})</h3><ul className="mt-2 divide-y divide-border text-sm">{d.google.descriptions.map((t) => <Line key={t} text={t} max={LIMITS.google.description} />)}</ul></Card>
            <Card>
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Mots-clés ({d.google.keywords.length})</h3><CopyButton text={d.google.keywords.join("\n")} label="Tout copier" /></div>
              <ul className="mt-2 flex flex-wrap gap-2">{d.google.keywords.map((k) => <li key={k} className="pill bg-surface-sunken text-text">{k}</li>)}</ul>
              {d.google.negatives.length > 0 && (
                <>
                  <div className="mt-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">À exclure ({d.google.negatives.length})</h3><CopyButton text={d.google.negatives.join("\n")} label="Tout copier" /></div>
                  <ul className="mt-2 flex flex-wrap gap-2">{d.google.negatives.map((k) => <li key={k} className="pill bg-danger-soft text-danger">{k}</li>)}</ul>
                </>
              )}
            </Card>
          </div>
        </div>
        <Card className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Adresse de destination</span><span className="min-w-0 flex-1 truncate text-text-muted" title={gUrl}>{gUrl}</span><CopyButton text={gUrl} /></Card>
      </section>

      <section aria-labelledby="h-meta" className="space-y-3">
        <div><h2 id="h-meta" className="text-lg">Meta Ads</h2><p className="text-sm text-text-muted">Publicité pour Facebook et Instagram : une image, un texte, un bouton.</p></div>
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="min-w-0 self-start">
            <p className="text-xs text-text-muted">Aperçu</p>
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <p className="p-3 text-sm">{d.meta.primaryTexts[0]}</p>
              <div className="aspect-video bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {ownImage ? <img src={ownImage} alt={article.imageAlt} className="size-full object-cover" /> : <p className="grid size-full place-items-center px-4 text-center text-xs text-text-muted">L'image de l'article s'affichera ici. Créez-la depuis la fiche de l'article.</p>}
              </div>
              <div className="flex items-center gap-3 bg-surface p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-xs uppercase text-text-muted">{host}</p><p className="truncate text-sm font-semibold">{d.meta.headline}</p>{d.meta.description && <p className="truncate text-xs text-text-muted">{d.meta.description}</p>}</div>
                <span className="btn btn-secondary btn-sm pointer-events-none shrink-0">{META_CTA[d.meta.cta]}</span>
              </div>
            </div>
          </Card>
          <div className="min-w-0 space-y-4">
            <Card><h3 className="font-semibold">Textes principaux ({d.meta.primaryTexts.length})</h3><ul className="mt-2 divide-y divide-border text-sm">{d.meta.primaryTexts.map((t) => <Line key={t} text={t} max={LIMITS.meta.primary} />)}</ul></Card>
            <Card>
              <h3 className="font-semibold">Titre, description, bouton</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                <Line text={d.meta.headline} max={LIMITS.meta.headline} />
                {d.meta.description && <Line text={d.meta.description} max={LIMITS.meta.description} />}
                <li className="py-1.5">Bouton : <strong className="font-semibold">{META_CTA[d.meta.cta]}</strong></li>
              </ul>
            </Card>
            <Card className="flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">Adresse de destination</span><span className="min-w-0 flex-1 truncate text-text-muted" title={mUrl}>{mUrl}</span><CopyButton text={mUrl} /></Card>
            {ownImage && <p className="text-sm"><a href={ownImage} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-2">Ouvrir l'image de l'article</a> <span className="text-text-muted">pour l'enregistrer, puis l'ajouter à la publicité.</span></p>}
          </div>
        </div>
      </section>

      <Card>
        <h2 className="font-semibold">Mettre en ligne</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-muted">
          <li><strong className="font-semibold text-text">Google Ads :</strong> importez le fichier dans Google Ads Editor. La campagne arrive en pause ; fixez votre budget par jour, puis activez-la.</li>
          <li><strong className="font-semibold text-text">Meta Ads :</strong> dans le Gestionnaire de publicités, créez une publicité, collez les textes et l'adresse, ajoutez l'image.</li>
          <li>Les visites venues de ces annonces sont repérables grâce au suivi ajouté à l'adresse (utm_source).</li>
        </ol>
      </Card>
    </>
  );
}
