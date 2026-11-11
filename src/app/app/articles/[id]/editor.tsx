"use client";
import { useMemo, useState } from "react";
import { publishArticle, saveArticle } from "@/app/actions";
import { ActionForm, Submit } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { markdownToHtml, wordCount } from "@/lib/domain/markdown";
import type { Article } from "@/lib/domain/types";

function Counter({ value, max, soft }: { value: string; max: number; soft: number }) {
  const n = [...value].length;
  return <span className={cx("text-xs tabular-nums", n > max ? "text-danger" : n > soft ? "text-warning" : "text-text-muted")}>{n} / {soft}</span>;
}

/** S14 : édition (Markdown simple) avec aperçu, panneau SEO et aperçu Google. */
export function ArticleEditor({ article, siteUrl, canPublish, publishMode, target = "wordpress" }: { article: Article; siteUrl: string; canPublish: boolean; publishMode: "draft" | "publish"; target?: "wordpress" | "github" }) {
  const gh = target === "github";
  const [title, setTitle] = useState(article.title);
  const [slug, setSlug] = useState(article.slug);
  const [metaTitle, setMetaTitle] = useState(article.metaTitle);
  const [metaDescription, setMetaDescription] = useState(article.metaDescription);
  const [body, setBody] = useState(article.bodyMd);
  const [tab, setTab] = useState<"edit" | "preview">("preview");
  const html = useMemo(() => markdownToHtml(body), [body]);
  // Comparé comme le serveur enregistre (espaces en trop retirés, retours à la ligne en \n).
  const dirty = title.trim() !== article.title || slug.trim() !== article.slug || metaTitle.trim() !== article.metaTitle
    || metaDescription.trim() !== article.metaDescription || body.replace(/\r\n?/g, "\n") !== article.bodyMd;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <ActionForm action={saveArticle} className="min-w-0 space-y-4" id="article-form">
        <input type="hidden" name="id" value={article.id} />
        <TextField label="Titre" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        <div className="card p-0">
          <div role="tablist" aria-label="Affichage" className="flex gap-1 border-b border-border p-2">
            {(["preview", "edit"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} id={`tab-${t}`} onClick={() => setTab(t)}
                className={cx("btn btn-sm", tab === t ? "btn-secondary" : "btn-ghost")}>{t === "preview" ? "Aperçu" : "Modifier le texte"}</button>
            ))}
            <span className="ml-auto self-center pr-2 text-xs tabular-nums text-text-muted">{wordCount(body)} mots</span>
          </div>
          <div id="panel-edit" role="tabpanel" aria-labelledby="tab-edit" hidden={tab !== "edit"} className="p-3">
            <label htmlFor="bodyMd" className="sr-only">Texte de l'article</label>
            <textarea id="bodyMd" name="bodyMd" value={body} onChange={(e) => setBody(e.target.value)} rows={24} className="field font-mono text-sm leading-6" spellCheck />
            <p className="mt-2 text-xs text-text-muted">« ## » pour un intertitre, « - » pour une liste, **gras**, [lien](https://…). Ligne vide entre les paragraphes.</p>
          </div>
          {/* Le HTML vient de markdownToHtml, qui échappe tout le texte : pas d'injection possible. */}
          <div id="panel-preview" role="tabpanel" aria-labelledby="tab-preview" hidden={tab !== "preview"}
            className="prose-article max-w-reading px-5 py-4 font-serif" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <details className="card" open>
          <summary className="cursor-pointer text-sm font-semibold">Référencement (SEO)</summary>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between"><label htmlFor="metaTitle" className="text-sm font-semibold">Titre SEO</label><Counter value={metaTitle} max={70} soft={60} /></div>
              <input id="metaTitle" name="metaTitle" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="field" maxLength={70} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><label htmlFor="metaDescription" className="text-sm font-semibold">Description</label><Counter value={metaDescription} max={170} soft={155} /></div>
              <textarea id="metaDescription" name="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="field" maxLength={170} />
            </div>
            <TextField label="Adresse (slug)" name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" required help={`${siteUrl.replace("https://", "")}/${slug}`} />
            <div className="rounded-md bg-surface p-3" aria-label="Aperçu dans Google">
              <p className="text-xs text-text-muted">Aperçu dans les résultats de recherche</p>
              <p className="mt-1 truncate text-xs text-text-muted">{siteUrl.replace("https://", "")} › {slug}</p>
              <p className="truncate text-base text-info">{metaTitle || title}</p>
              <p className="line-clamp-2 text-sm text-text-muted">{metaDescription}</p>
            </div>
          </div>
        </details>
        <div className="flex items-center gap-3">
          <Submit variant={dirty ? "primary" : "secondary"}>Enregistrer</Submit>
          {dirty && <span className="text-xs text-warning" role="status">Modifications non enregistrées</span>}
        </div>
      </ActionForm>

      <aside className="space-y-4">
        <ActionForm action={publishArticle} className="card space-y-3">
          <input type="hidden" name="id" value={article.id} />
          <p className="text-sm font-semibold">{publishMode === "draft" ? "Envoyer en brouillon" : "Publier"}</p>
          <p className="text-xs text-text-muted">{publishMode === "draft" ? (gh ? "L'article est écrit dans le dépôt du site, marqué brouillon : il n'apparaît pas encore sur le site." : "L'article arrive en brouillon dans WordPress : vous le publiez de là-bas.") : gh ? "L'article paraît sur votre site à sa prochaine mise en ligne (en général une minute)." : "L'article paraît tout de suite sur votre site."}</p>
          {canPublish ? (
            <>
              <Submit className="w-full" disabled={dirty}>{gh ? (publishMode === "draft" ? "Envoyer en brouillon" : "Publier sur le site") : publishMode === "draft" ? "Envoyer à WordPress" : "Publier sur WordPress"}</Submit>
              {dirty && <p className="text-xs text-text-muted">Enregistrez d'abord vos modifications.</p>}
            </>
          ) : (
            <a href="/app/integrations" className="btn btn-secondary w-full">Connecter votre site</a>
          )}
        </ActionForm>
        <div className="card space-y-2">
          <p className="text-sm font-semibold">Liens internes</p>
          {article.internalLinks.length ? (
            <ul className="space-y-1 text-sm">{article.internalLinks.map((l) => <li key={l.url} className="truncate"><span className="text-text-muted">→</span> {l.anchor}</li>)}</ul>
          ) : (
            <p className="text-xs text-text-muted">Aucun pour l'instant : les prochains articles renverront vers celui-ci.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
